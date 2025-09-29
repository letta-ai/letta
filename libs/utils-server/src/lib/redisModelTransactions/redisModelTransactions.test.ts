import { getRedisModelTransactions } from './redisModelTransactions';
import { createRedisInstance, getRedisModelTransactionsKey } from '@letta-cloud/service-redis';
import { db, organizationCreditTransactions } from '@letta-cloud/service-database';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import * as Sentry from '@sentry/node';

// Mock environment configuration
jest.mock('@letta-cloud/config-environment-variables', () => ({
  environment: {
    REDIS_CACHE_TTL: 60,
  },
}));

// Mock service dependencies
jest.mock('@letta-cloud/service-email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@letta-cloud/service-clickhouse', () => ({
  trackDailyAgentUsage: jest.fn(),
}));

// Mock dependencies
jest.mock('@letta-cloud/service-redis');
jest.mock('@letta-cloud/service-database');
jest.mock('@letta-cloud/service-payments');
jest.mock('@sentry/node');

const mockCreateRedisInstance = createRedisInstance as jest.MockedFunction<typeof createRedisInstance>;
const mockGetRedisModelTransactionsKey = getRedisModelTransactionsKey as jest.MockedFunction<typeof getRedisModelTransactionsKey>;
const mockGetCustomerSubscription = getCustomerSubscription as jest.MockedFunction<typeof getCustomerSubscription>;
const mockSentryCapture = Sentry.captureException as jest.MockedFunction<typeof Sentry.captureException>;

describe('getRedisModelTransactions', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
  };

  const mockDb = {
    select: jest.fn(),
  };

  const testType = 'gpt-4' as any;
  const testOrgId = 'org-123';
  const testRedisKey = 'redis:key:test';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRedisInstance.mockReturnValue(mockRedis as any);
    mockGetRedisModelTransactionsKey.mockReturnValue(testRedisKey);
    (db as any) = mockDb;
  });

  describe('when data exists in Redis cache', () => {
    it('should return cached value without database queries', async () => {
      mockRedis.get.mockResolvedValue('42');

      const result = await getRedisModelTransactions(testType, testOrgId);

      expect(result).toBe(42);
      expect(mockRedis.get).toHaveBeenCalledWith(testRedisKey);
      expect(mockGetCustomerSubscription).not.toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should parse cached string values correctly', async () => {
      mockRedis.get.mockResolvedValue('156');

      const result = await getRedisModelTransactions(testType, testOrgId);

      expect(result).toBe(156);
    });
  });

  describe('when data does not exist in Redis cache', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
    });

    it('should throw error when subscription is not found', async () => {
      mockGetCustomerSubscription.mockResolvedValue(null as any);

      await expect(getRedisModelTransactions(testType, testOrgId))
        .rejects.toThrow(`Could not find organization with id ${testOrgId}`);
    });

    it('should throw error when database query returns no results', async () => {
      const mockSubscription = {
        tier: 'pro-legacy' as const,
        billingPeriodStart: '2024-01-01T00:00:00Z',
        billingPeriodEnd: '2024-02-01T00:00:00Z',
      };

      mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(getRedisModelTransactions(testType, testOrgId))
        .rejects.toThrow(`Could not find organization credits for organization with id ${testOrgId}`);
    });
  });

  describe('expiration time calculation', () => {
    const mockSubscription = {
      tier: 'pro-legacy' as const,
      billingPeriodStart: '2024-01-01T00:00:00Z',
      billingPeriodEnd: '2024-02-01T00:00:00Z',
    };

    const mockDbResult = [{ count: 10 }];

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockDbResult),
        }),
      });
    });

    it('should set expiration to 24 hours when billing period is far in future', async () => {
      // Mock current time to be much earlier than billing period end
      const mockNow = new Date('2024-01-15T00:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      await getRedisModelTransactions(testType, testOrgId);

      // Should use 24 hours (86400 seconds) as minimum
      expect(mockRedis.setex).toHaveBeenCalledWith(testRedisKey, 86400, 10);
    });

    it('should demonstrate the current calculation bug (divides only getTime() by 1000)', async () => {
      // Mock current time to be close to billing period end
      const billingEndTime = new Date('2024-02-01T00:00:00Z').getTime();
      const mockNow = billingEndTime - (12 * 60 * 60 * 1000); // 12 hours before end

      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      await getRedisModelTransactions(testType, testOrgId);

      // NOTE: Due to bug in line 58, the calculation is:
      // Math.round((billingEndTime - (mockNow / 1000)))
      // This results in a very large number, so it defaults to 24 hours (86400)
      expect(mockRedis.setex).toHaveBeenCalledWith(testRedisKey, 86400, 10);
    });

    it('should default to 24 hours when expiration time is zero or negative', async () => {
      // Mock current time to be after billing period end
      const billingEndTime = new Date('2024-02-01T00:00:00Z').getTime();
      const mockNow = billingEndTime + (1 * 60 * 60 * 1000); // 1 hour after end

      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      await getRedisModelTransactions(testType, testOrgId);

      // Should fallback to 24 hours
      expect(mockRedis.setex).toHaveBeenCalledWith(testRedisKey, 86400, 10);
    });

    it('should handle expiration time calculation errors with fallback', async () => {
      // Mock Math.min to throw an error to simulate calculation failure
      const originalMin = Math.min;
      jest.spyOn(Math, 'min').mockImplementation(() => {
        throw new Error('Date parsing error');
      });

      await getRedisModelTransactions(testType, testOrgId);

      // Should capture exception and use fallback expiration
      expect(mockSentryCapture).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledTimes(1); // Fallback setex call
      expect(mockRedis.setex).toHaveBeenCalledWith(testRedisKey, 86400, 10);

      // Restore original Math.min
      Math.min = originalMin;
    });
  });

  describe('Redis operations', () => {
    const mockSubscription = {
      tier: 'pro-legacy' as const,
      billingPeriodStart: '2024-01-01T00:00:00Z',
      billingPeriodEnd: '2024-02-01T00:00:00Z',
    };

    const mockDbResult = [{ count: 25 }];

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockDbResult),
        }),
      });
    });

    it('should call Redis setex with correct parameters', async () => {
      const result = await getRedisModelTransactions(testType, testOrgId);

      expect(result).toBe(25);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        testRedisKey,
        expect.any(Number), // expiration time
        25 // count value
      );
    });

    it('should use correct Redis key from helper function', async () => {
      await getRedisModelTransactions(testType, testOrgId);

      expect(mockGetRedisModelTransactionsKey).toHaveBeenCalledWith(testType, testOrgId);
      expect(mockRedis.get).toHaveBeenCalledWith(testRedisKey);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        testRedisKey,
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('database query validation', () => {
    const mockSubscription = {
      tier: 'pro-legacy' as const,
      billingPeriodStart: '2024-01-01T00:00:00Z',
      billingPeriodEnd: '2024-02-01T00:00:00Z',
    };

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null);
      mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
    });

    it('should query database with correct filters', async () => {
      const mockWhere = jest.fn().mockResolvedValue([{ count: 15 }]);
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      await getRedisModelTransactions(testType, testOrgId);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith(organizationCreditTransactions);
      expect(mockWhere).toHaveBeenCalled();
    });

    it('should return correct count from database result', async () => {
      const expectedCount = 99;
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: expectedCount }]),
        }),
      });

      const result = await getRedisModelTransactions(testType, testOrgId);

      expect(result).toBe(expectedCount);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});

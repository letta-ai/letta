import { mockDatabase } from '@letta-cloud/service-database-testing';

jest.mock('@letta-cloud/service-database', () => ({
  db: mockDatabase,
  organizationBillingDetails: {},
}));

import { getCustomerSubscription } from './getCustomerSubscription';
import { getStripeClient } from '../getStripeClient/getStripeClient';
import { getRedisData, setRedisData } from '@letta-cloud/service-redis';
import { LEGACY_PRO_PLAN_PRODUCT_IDS, SCALE_PLAN_PRODUCT_IDS } from '../constants';
import { startOfMonth, endOfMonth } from 'date-fns';

jest.mock('../getStripeClient/getStripeClient');
jest.mock('@letta-cloud/config-environment-variables', () => {
  return {
    environment: {
      REDIS_CACHE_TTL: 60, // Mocking the environment variable for cache TTL
    },
  };
});
jest.mock('@letta-cloud/service-redis');
jest.mock('date-fns', () => ({
  startOfMonth: jest.fn(),
  endOfMonth: jest.fn(),
}));

const mockGetStripeClient = getStripeClient as jest.MockedFunction<
  typeof getStripeClient
>;
const mockGetRedisData = getRedisData as jest.MockedFunction<
  typeof getRedisData
>;
const mockSetRedisData = setRedisData as jest.MockedFunction<
  typeof setRedisData
>;
const mockStartOfMonth = startOfMonth as jest.MockedFunction<
  typeof startOfMonth
>;
const mockEndOfMonth = endOfMonth as jest.MockedFunction<typeof endOfMonth>;

describe('getCustomerSubscription', () => {
  const mockOrganizationId = 'org-123';
  const mockCustomerId = 'cus_123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockGetRedisData.mockResolvedValue(null);
    mockSetRedisData.mockResolvedValue(undefined);
    mockStartOfMonth.mockReturnValue(new Date('2024-01-01'));
    mockEndOfMonth.mockReturnValue(new Date('2024-01-31'));
  });

  describe('Redis caching', () => {
    it('should return cached data when available', async () => {
      const cachedResult = {
        tier: 'pro-legacy' as const,
        billingPeriodEnd: '2024-01-31',
        billingPeriodStart: '2024-01-01',
        id: 'sub_123',
      };

      mockGetRedisData.mockResolvedValue(cachedResult);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual(cachedResult);
      expect(mockGetRedisData).toHaveBeenCalledWith('customerSubscription', {
        organizationId: mockOrganizationId,
      });
      expect(
        mockDatabase.query.organizationBillingDetails.findFirst,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Database and Stripe integration', () => {
    beforeEach(() => {
      mockGetRedisData.mockResolvedValue(null);

      // Mock database response
      mockDatabase.query.organizationBillingDetails.findFirst.mockResolvedValue(
        {
          organizationId: mockOrganizationId,
          stripeCustomerId: mockCustomerId,
          billingTier: 'stripe_managed',
          pricingModel: 'prepay',
          monthlyCreditAllocation: null,
        },
      );
    });

    it('should return free tier when no Stripe client', async () => {
      // @ts-expect-error mocking getStripeClient to return null
      mockGetStripeClient.mockReturnValue(null);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'free',
        billingPeriodEnd: '2024-01-31T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return free tier when no customer found in database', async () => {
      mockDatabase.query.organizationBillingDetails.findFirst.mockResolvedValue(
        undefined,
      );

      const mockStripe = {
        subscriptions: {
          list: jest.fn(),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'free',
        billingPeriodEnd: '2024-01-31T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return enterprise tier for enterprise customers', async () => {
      mockDatabase.query.organizationBillingDetails.findFirst.mockResolvedValue(
        {
          organizationId: mockOrganizationId,
          stripeCustomerId: mockCustomerId,
          billingTier: 'enterprise',
          pricingModel: 'prepay',
          monthlyCreditAllocation: null,
        },
      );

      const mockStripe = {
        subscriptions: {
          list: jest.fn(),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'enterprise',
        billingPeriodEnd: '2024-01-31T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return pro-legacy tier for active pro-legacy subscription', async () => {
      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'sub_123',
                status: 'active',
                items: {
                  data: [
                    {
                      price: {
                        product: LEGACY_PRO_PLAN_PRODUCT_IDS[0],
                      },
                    },
                  ],
                },
                current_period_start: 1704067200,
                current_period_end: 1706745600,
                cancel_at_period_end: false,
              },
            ],
          }),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'pro-legacy',
        billingPeriodEnd: '2024-02-01T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
        id: 'sub_123',
        cancelled: false,
      });
    });

    it('should return scale tier for active scale subscription', async () => {
      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'sub_456',
                status: 'active',
                items: {
                  data: [
                    {
                      price: {
                        product: SCALE_PLAN_PRODUCT_IDS[0],
                      },
                    },
                  ],
                },
                current_period_start: 1704067200,
                current_period_end: 1706745600,
                cancel_at_period_end: false,
              },
            ],
          }),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'scale',
        billingPeriodEnd: '2024-02-01T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
        id: 'sub_456',
        cancelled: false,
      });
    });

    it('should return cancelled subscription with cancelled flag', async () => {
      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'sub_789',
                status: 'active',
                items: {
                  data: [
                    {
                      price: {
                        product: LEGACY_PRO_PLAN_PRODUCT_IDS[0],
                      },
                    },
                  ],
                },
                current_period_start: 1704067200,
                current_period_end: 1706745600,
                cancel_at_period_end: true,
              },
            ],
          }),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'pro-legacy',
        billingPeriodEnd: '2024-02-01T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
        cancelled: true,
        id: 'sub_789',
      });
    });

    it('should return trialing subscription', async () => {
      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'sub_trial',
                status: 'trialing',
                items: {
                  data: [
                    {
                      price: {
                        product: LEGACY_PRO_PLAN_PRODUCT_IDS[0],
                      },
                    },
                  ],
                },
                current_period_start: 1704067200,
                current_period_end: 1706745600,
                cancel_at_period_end: false,
              },
            ],
          }),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'pro-legacy',
        billingPeriodEnd: '2024-02-01T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
        id: 'sub_trial',
        cancelled: false,
      });
    });

    it('should ignore inactive subscriptions', async () => {
      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'sub_inactive',
                status: 'canceled',
                items: {
                  data: [
                    {
                      price: {
                        product: LEGACY_PRO_PLAN_PRODUCT_IDS[0],
                      },
                    },
                  ],
                },
                current_period_start: 1704067200,
                current_period_end: 1706745600,
                cancel_at_period_end: false,
              },
            ],
          }),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'free',
        billingPeriodEnd: '2024-01-31T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
      });
    });

    it('should return free tier when no active subscriptions', async () => {
      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({
            data: [],
          }),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      const result = await getCustomerSubscription(mockOrganizationId);

      expect(result).toEqual({
        tier: 'free',
        billingPeriodEnd: '2024-01-31T00:00:00.000Z',
        billingPeriodStart: '2024-01-01T00:00:00.000Z',
      });
    });
  });

  describe('Caching behavior', () => {
    beforeEach(() => {
      mockGetRedisData.mockResolvedValue(null);
      mockDatabase.query.organizationBillingDetails.findFirst.mockResolvedValue(
        {
          organizationId: mockOrganizationId,
          stripeCustomerId: mockCustomerId,
          billingTier: 'stripe_managed',
          pricingModel: 'prepay',
          monthlyCreditAllocation: null,
        },
      );
    });

    it('should cache free tier subscription for 1 hour', async () => {
      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({ data: [] }),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      await getCustomerSubscription(mockOrganizationId);

      expect(mockSetRedisData).toHaveBeenCalledWith(
        'customerSubscription',
        { organizationId: mockOrganizationId },
        expect.objectContaining({
          data: expect.objectContaining({ tier: 'free' }),
          expiresAt: expect.any(Number),
        }),
      );
    });

    it('should cache paid subscription until billing period end', async () => {
      const billingPeriodEnd = 1706745600; // 2024-02-01
      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'sub_123',
                status: 'active',
                items: {
                  data: [
                    {
                      price: {
                        product: LEGACY_PRO_PLAN_PRODUCT_IDS[0],
                      },
                    },
                  ],
                },
                current_period_start: 1704067200,
                current_period_end: billingPeriodEnd,
                cancel_at_period_end: false,
              },
            ],
          }),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      await getCustomerSubscription(mockOrganizationId);

      expect(mockSetRedisData).toHaveBeenCalledWith(
        'customerSubscription',
        { organizationId: mockOrganizationId },
        expect.objectContaining({
          data: expect.objectContaining({ tier: 'pro-legacy' }),
          expiresAt: expect.any(Number),
        }),
      );
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockGetRedisData.mockResolvedValue(null);
    });

    it('should handle database errors gracefully', async () => {
      mockDatabase.query.organizationBillingDetails.findFirst.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(getCustomerSubscription(mockOrganizationId)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle Stripe API errors gracefully', async () => {
      mockDatabase.query.organizationBillingDetails.findFirst.mockResolvedValue(
        {
          organizationId: mockOrganizationId,
          stripeCustomerId: mockCustomerId,
          billingTier: 'stripe_managed',
          pricingModel: 'prepay',
          monthlyCreditAllocation: null,
        },
      );

      const mockStripe = {
        subscriptions: {
          list: jest.fn().mockRejectedValue(new Error('Stripe API error')),
        },
      } as any;
      mockGetStripeClient.mockReturnValue(mockStripe);

      await expect(getCustomerSubscription(mockOrganizationId)).rejects.toThrow(
        'Stripe API error',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockGetRedisData.mockRejectedValue(new Error('Redis error'));

      await expect(getCustomerSubscription(mockOrganizationId)).rejects.toThrow(
        'Redis error',
      );
    });
  });
});

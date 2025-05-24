import { getCanAgentBeUsed } from './getCanAgentBeUsed';
import { getRedisData } from '@letta-cloud/service-redis';
import { markActiveAgent } from '../../markActiveAgent/markActiveAgent';
import { getActiveBillableAgentsCount } from '@letta-cloud/service-payments';

jest.mock('@letta-cloud/service-redis', () => ({
  getRedisData: jest.fn(),
  setRedisData: jest.fn(),
}));

jest.mock('@letta-cloud/service-email', () => ({
  sendEmail: jest.fn(),
}));
jest.mock('@letta-cloud/service-payments');
jest.mock('../../markActiveAgent/markActiveAgent');

// Mock the LRUCache module
jest.mock('lru-cache', () => {
  return {
    LRUCache: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
    })),
  };
});

const mockGetRedisData = getRedisData as jest.MockedFunction<
  typeof getRedisData
>;
const mockGetActiveBillableAgentsCount =
  getActiveBillableAgentsCount as jest.MockedFunction<
    typeof getActiveBillableAgentsCount
  >;
const mockMarkActiveAgent = markActiveAgent as jest.MockedFunction<
  typeof markActiveAgent
>;

describe('getCanAgentBeUsed', () => {
  const mockOptions = {
    agentId: 'test-agent-id',
    organizationId: 'test-org-id',
    billingPeriodStart: '2024-01-01T00:00:00Z',
    agentLimit: 5,
  };

  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the cache mock for each test
    const { LRUCache } = require('lru-cache');
    LRUCache.mockClear();
  });

  describe('when agent is active and billed', () => {
    it('should return true for active billed agent within billing period', async () => {
      const activeAgent = {
        lastActiveAt: new Date('2024-01-15T00:00:00Z').getTime(), // After billing period start
        isBilledAgent: true,
      };

      mockGetRedisData.mockResolvedValue(activeAgent);

      const result = await getCanAgentBeUsed(mockOptions);

      expect(result).toBe(true);
      expect(mockGetRedisData).toHaveBeenCalledWith('activeAgent', {
        agentId: mockOptions.agentId,
      });
      expect(mockMarkActiveAgent).toHaveBeenCalledWith({
        organizationId: mockOptions.organizationId,
        agentId: mockOptions.agentId,
        isBilledAgent: true,
      });
    });

    it('should not check agent count when agent is already active and billed', async () => {
      const activeAgent = {
        lastActiveAt: new Date('2024-01-15T00:00:00Z').getTime(),
        isBilledAgent: true,
      };

      mockGetRedisData.mockResolvedValue(activeAgent);

      await getCanAgentBeUsed(mockOptions);

      expect(mockGetActiveBillableAgentsCount).not.toHaveBeenCalled();
    });
  });

  describe('when agent is active but not billed or outside billing period', () => {
    it('should check agent limits for active agent outside billing period', async () => {
      const activeAgent = {
        lastActiveAt: new Date('2023-12-15T00:00:00Z').getTime(), // Before billing period start
        isBilledAgent: true,
      };

      mockGetRedisData.mockResolvedValue(activeAgent);
      mockGetActiveBillableAgentsCount.mockResolvedValue(3);

      const result = await getCanAgentBeUsed(mockOptions);

      expect(result).toBe(true);
      expect(mockGetActiveBillableAgentsCount).toHaveBeenCalledWith(
        mockOptions.organizationId,
      );
    });

    it('should check agent limits for active agent that is not billed', async () => {
      const activeAgent = {
        lastActiveAt: new Date('2024-01-15T00:00:00Z').getTime(), // After billing period start
        isBilledAgent: false,
      };

      mockGetRedisData.mockResolvedValue(activeAgent);
      mockGetActiveBillableAgentsCount.mockResolvedValue(3);

      const result = await getCanAgentBeUsed(mockOptions);

      expect(result).toBe(true);
      expect(mockGetActiveBillableAgentsCount).toHaveBeenCalledWith(
        mockOptions.organizationId,
      );
    });
  });

  describe('when agent is not active', () => {
    it('should return true when agent count is below limit', async () => {
      mockGetRedisData.mockResolvedValue(null);
      mockGetActiveBillableAgentsCount.mockResolvedValue(3);

      const result = await getCanAgentBeUsed(mockOptions);

      expect(result).toBe(true);
      expect(mockGetActiveBillableAgentsCount).toHaveBeenCalledWith(
        mockOptions.organizationId,
      );
      expect(mockMarkActiveAgent).toHaveBeenCalledWith({
        organizationId: mockOptions.organizationId,
        agentId: mockOptions.agentId,
        isBilledAgent: true,
      });
    });

    it('should return false when agent count equals limit', async () => {
      mockGetRedisData.mockResolvedValue(null);
      mockGetActiveBillableAgentsCount.mockResolvedValue(5); // Equal to limit

      const result = await getCanAgentBeUsed(mockOptions);

      expect(result).toBe(false);
      expect(mockMarkActiveAgent).toHaveBeenCalledWith({
        organizationId: mockOptions.organizationId,
        agentId: mockOptions.agentId,
        isBilledAgent: false,
      });
    });

    it('should return false when agent count exceeds limit', async () => {
      mockGetRedisData.mockResolvedValue(null);
      mockGetActiveBillableAgentsCount.mockResolvedValue(7); // Above limit

      const result = await getCanAgentBeUsed(mockOptions);

      expect(result).toBe(false);
      expect(mockMarkActiveAgent).toHaveBeenCalledWith({
        organizationId: mockOptions.organizationId,
        agentId: mockOptions.agentId,
        isBilledAgent: false,
      });
    });
  });

  describe('edge cases', () => {
    it('should handle Redis data returning undefined', async () => {
      // @ts-expect-error - Mocking Redis data to return undefined
      mockGetRedisData.mockResolvedValue(undefined);
      mockGetActiveBillableAgentsCount.mockResolvedValue(2);

      const result = await getCanAgentBeUsed(mockOptions);

      expect(result).toBe(true);
      expect(mockGetActiveBillableAgentsCount).toHaveBeenCalled();
    });

    it('should handle zero agent limit', async () => {
      const optionsWithZeroLimit = { ...mockOptions, agentLimit: 0 };
      mockGetRedisData.mockResolvedValue(null);
      mockGetActiveBillableAgentsCount.mockResolvedValue(0);

      const result = await getCanAgentBeUsed(optionsWithZeroLimit);

      expect(result).toBe(false);
    });

    it('should handle negative agent count', async () => {
      mockGetRedisData.mockResolvedValue(null);
      mockGetActiveBillableAgentsCount.mockResolvedValue(-1);

      const result = await getCanAgentBeUsed(mockOptions);

      expect(result).toBe(true); // -1 < 5
    });

    it('should always call markActiveAgent regardless of result', async () => {
      // Test case where agent cannot be used
      mockGetRedisData.mockResolvedValue(null);
      mockGetActiveBillableAgentsCount.mockResolvedValue(10); // Above limit

      await getCanAgentBeUsed(mockOptions);

      expect(mockMarkActiveAgent).toHaveBeenCalledWith({
        organizationId: mockOptions.organizationId,
        agentId: mockOptions.agentId,
        isBilledAgent: false,
      });

      jest.clearAllMocks();

      // Test case where agent can be used
      mockGetRedisData.mockResolvedValue(null);
      mockGetActiveBillableAgentsCount.mockResolvedValue(2); // Below limit

      await getCanAgentBeUsed(mockOptions);

      expect(mockMarkActiveAgent).toHaveBeenCalledWith({
        organizationId: mockOptions.organizationId,
        agentId: mockOptions.agentId,
        isBilledAgent: true,
      });
    });
  });
});

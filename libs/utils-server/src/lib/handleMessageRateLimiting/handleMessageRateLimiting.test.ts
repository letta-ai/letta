import {
  getRedisData as getRedisDataBase,
  setRedisData,
} from '@letta-cloud/service-redis';
import { get } from 'lodash';
import { mockDatabase } from '@letta-cloud/service-database-testing';
import { getAndSeedOrganizationLimits, handleMessageRateLimiting } from './handleMessageRateLimiting';
import { AgentsService } from '@letta-cloud/sdk-core';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getRemainingRecurrentCredits } from '../recurringCreditsManager/recurringCreditsManager';
import { getOrganizationCredits } from '../redisOrganizationCredits/redisOrganizationCredits';
import { getCreditCostPerModel } from '../getCreditCostPerModel/getCreditCostPerModel';

jest.mock('@letta-cloud/utils-shared', () => ({
  ...jest.requireActual('@letta-cloud/utils-shared'),
}));

jest.mock('@letta-cloud/config-environment-variables', () => {
  return {
    environment: {
      REDIS_CACHE_TTL: 60, // Mocking the environment variable for cache TTL
    },
  };
});
jest.mock('@letta-cloud/service-clickhouse', () => ({
  trackDailyAgentUsage: jest.fn(),
}));
jest.mock('@letta-cloud/service-redis', () => ({
  getRedisData: jest.fn(),
  setRedisData: jest.fn(),
}));

// Mock sdk-core before it's imported to avoid circular dependency issues
jest.mock('@letta-cloud/sdk-core', () => {
  const actual = jest.requireActual('@letta-cloud/sdk-core');
  return {
    ...actual,
    AgentsService: {
      retrieveAgent: jest.fn(),
    },
  };
});

jest.mock('@letta-cloud/service-email', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@letta-cloud/service-payments', () => ({
  getCustomerSubscription: jest.fn(),
}));

jest.mock('../recurringCreditsManager/recurringCreditsManager', () => ({
  getRemainingRecurrentCredits: jest.fn(),
}));

jest.mock('../redisOrganizationCredits/redisOrganizationCredits', () => ({
  getOrganizationCredits: jest.fn(),
}));

jest.mock('../getCreditCostPerModel/getCreditCostPerModel', () => ({
  getCreditCostPerModel: jest.fn(),
}));

jest.mock('../redisModelTransactions/redisModelTransactions', () => ({
  getRedisModelTransactions: jest.fn(),
}));

const getRedisData = getRedisDataBase as jest.Mock;
const mockAgentsService = AgentsService as jest.Mocked<typeof AgentsService>;
const mockGetCustomerSubscription = getCustomerSubscription as jest.Mock;
const mockGetRemainingRecurrentCredits = getRemainingRecurrentCredits as jest.Mock;
const mockGetOrganizationCredits = getOrganizationCredits as jest.Mock;
const mockGetCreditCostPerModel = getCreditCostPerModel as jest.Mock;

describe('getAndSeedOrganizationLimits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch limits from organizationLimits  ', async () => {
    getRedisData.mockImplementation((query, payload) => {
      if (
        query === 'organizationRateLimitsPerModel' &&
        get(payload, 'organizationId') === '1' &&
        get(payload, 'modelId') === 'chatgpt'
      ) {
        return {
          maxRequestsPerMinutePerModel: 50,
          maxTokensPerMinutePerModel: 100,
        };
      }

      return null;
    });

    const response = await getAndSeedOrganizationLimits({
      organizationId: '1',
      modelId: 'chatgpt',
      type: 'inference',
    });

    expect(
      mockDatabase.query.perModelPerOrganizationRateLimitOverrides.findFirst,
    ).not.toHaveBeenCalled();
    expect(setRedisData).not.toHaveBeenCalled();
    expect(response.maxRequestsPerMinutePerModel).toBe(50);
    expect(response.maxTokensPerMinutePerModel).toBe(100);
  });

  it('should populate limits from organizationLimits from database if not found in redis', async () => {
    getRedisData.mockResolvedValue(null);

    const organizationLimitResponse = {
      organizationId: '1',
      modelId: 'chatgpt',
      maxRequestsPerMinute: '25',
      maxTokensPerMinute: '95',
    };

    mockDatabase.query.perModelPerOrganizationRateLimitOverrides.findFirst.mockResolvedValue(
      organizationLimitResponse,
    );

    const response = await getAndSeedOrganizationLimits({
      organizationId: '1',
      modelId: 'chatgpt',
      type: 'inference',
    });
    expect(setRedisData).toHaveBeenCalledWith(
      'organizationRateLimitsPerModel',
      { organizationId: '1', modelId: 'chatgpt' },
      {
        expiresAt: expect.any(Number),
        data: {
          maxRequestsPerMinutePerModel: parseInt(
            organizationLimitResponse.maxRequestsPerMinute,
            10,
          ),
          maxTokensPerMinutePerModel: parseInt(
            organizationLimitResponse.maxTokensPerMinute,
            10,
          ),
        },
      },
    );
    expect(response.maxRequestsPerMinutePerModel).toBe(25);
    expect(response.maxTokensPerMinutePerModel).toBe(95);
  });

  it('should get default limits if no organization limits for a specific model are not found', async () => {
    getRedisData.mockImplementation((query, payload) => {
      if (
        query === 'organizationRateLimitsPerModel' &&
        get(payload, 'organizationId') === '1' &&
        get(payload, 'modelId') === 'chatgpt'
      ) {
        return {
          maxRequestsPerMinutePerModel: undefined,
          maxTokensPerMinutePerModel: undefined,
        };
      }

      if (
        query === 'defaultModelRequestPerMinute' &&
        get(payload, 'modelId') === 'chatgpt'
      ) {
        return {
          maxRequestsPerMinute: 24,
        };
      }

      if (
        query === 'defaultModelTokensPerMinute' &&
        get(payload, 'modelId') === 'chatgpt'
      ) {
        return {
          maxTokensPerMinute: 91,
        };
      }

      return null;
    });

    const response = await getAndSeedOrganizationLimits({
      organizationId: '1',
      modelId: 'chatgpt',
      type: 'inference',
    });

    expect(
      mockDatabase.query.perModelPerOrganizationRateLimitOverrides.findFirst,
    ).not.toHaveBeenCalled();
    expect(setRedisData).not.toHaveBeenCalled();
    expect(response.maxRequestsPerMinutePerModel).toBe(24);
    expect(response.maxTokensPerMinutePerModel).toBe(91);
  });

  it('should get default limits from database if not found in redis', async () => {
    getRedisData.mockImplementation((query, payload) => {
      if (
        query === 'organizationRateLimitsPerModel' &&
        get(payload, 'modelId') === 'chatgpt' &&
        get(payload, 'organizationId') === '1'
      ) {
        return {
          maxRequestsPerMinutePerModel: undefined,
          maxTokensPerMinutePerModel: undefined,
        };
      }

      return null;
    });

    mockDatabase.query.perModelPerOrganizationRateLimitOverrides.findFirst.mockResolvedValue(
      undefined,
    );

    mockDatabase.query.inferenceModelsMetadata.findFirst.mockResolvedValue({
      id: 'chatgpt',
      defaultRequestsPerMinutePerOrganization: '26',
      defaultTokensPerMinutePerOrganization: '98',
      name: 'ChatGPT',
      brand: 'OpenAI',
      isRecommended: true,
      modelName: 'gpt-3.5-turbo',
      modelEndpoint:
        'https://api.openai.com/v1/engines/gpt-3.5-turbo/completions',
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
      tag: null,
    } as any);

    const response = await getAndSeedOrganizationLimits({
      organizationId: '1',
      modelId: 'chatgpt',
      type: 'inference',
    });

    expect(setRedisData).toHaveBeenCalledWith(
      'defaultModelRequestPerMinute',
      { modelId: 'chatgpt' },
      {
        data: {
          maxRequestsPerMinute: 26,
        },
      },
    );
    expect(setRedisData).toHaveBeenCalledWith(
      'defaultModelTokensPerMinute',
      { modelId: 'chatgpt' },
      {
        data: {
          maxTokensPerMinute: 98,
        },
      },
    );

    expect(
      mockDatabase.query.perModelPerOrganizationRateLimitOverrides.findFirst,
    ).not.toHaveBeenCalled();
    expect(response.maxRequestsPerMinutePerModel).toBe(26);
    expect(response.maxTokensPerMinutePerModel).toBe(98);
    expect(
      mockDatabase.query.inferenceModelsMetadata.findFirst,
    ).toHaveBeenCalled();
  });
});

describe('handleMessageRateLimiting - Pro Subscriptions', () => {
  const mockAgent = {
    id: 'agent-1',
    llm_config: {
      model: 'gpt-4',
      model_endpoint: 'https://api.openai.com/v1',
      provider_category: 'managed',
    },
    project_id: 'project-1',
    template_id: 'template-1',
    base_template_id: 'base-template-1',
  };

  const mockRequest = {
    headers: {},
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentsService.retrieveAgent.mockResolvedValue(mockAgent as any);
  });

  it('should allow request for pro user with sufficient recurrent credits', async () => {
    const mockSubscription = {
      tier: 'pro',
      billingPeriodStart: Date.now(),
    };

    mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
    mockGetOrganizationCredits.mockResolvedValue(0); // No purchased credits
    mockGetRemainingRecurrentCredits.mockResolvedValue(5); // Has recurrent credits
    mockGetCreditCostPerModel.mockResolvedValue(1);

    getRedisData.mockImplementation((query, payload) => {
      if (query === 'modelNameAndEndpointToIdMap') {
        return { modelId: 'gpt-4-model-id' };
      }
      if (query === 'organizationToCoreOrganization') {
        return { coreOrganizationId: 'core-org-1' };
      }
      if (query === 'rpmWindow' || query === 'tpmWindow') {
        return { data: 0 };
      }
      if (query === 'deployedAgent') {
        return { isDeployed: false };
      }
      if (query === 'organizationRateLimitsPerModel') {
        return {
          maxRequestsPerMinutePerModel: 100,
          maxTokensPerMinutePerModel: 1000,
        };
      }
      return null;
    });

    const result = await handleMessageRateLimiting(mockRequest, {
      organizationId: 'org-1',
      agentId: 'agent-1',
      messages: [],
      type: 'inference',
      lettaAgentsUserId: 'user-1',
    });

    expect(result.isRateLimited).toBe(false);
    expect(mockGetRemainingRecurrentCredits).toHaveBeenCalledWith('org-1', mockSubscription);
  });

  it('should rate limit pro user when recurrent credits are exceeded', async () => {
    const mockSubscription = {
      tier: 'pro',
      billingPeriodStart: Date.now(),
      stripeProductId: 'prod_starter',
    };

    mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
    mockGetOrganizationCredits.mockResolvedValue(0); // No purchased credits
    mockGetRemainingRecurrentCredits.mockResolvedValue(20000); // Exceeded recurrent limit (pro limit is 20,000)
    mockGetCreditCostPerModel.mockResolvedValue(1);

    getRedisData.mockImplementation((query, payload) => {
      if (query === 'modelNameAndEndpointToIdMap') {
        return { modelId: 'gpt-4-model-id' };
      }
      if (query === 'organizationToCoreOrganization') {
        return { coreOrganizationId: 'core-org-1' };
      }
      if (query === 'rpmWindow' || query === 'tpmWindow') {
        return { data: 0 };
      }
      if (query === 'deployedAgent') {
        return { isDeployed: false };
      }
      if (query === 'organizationRateLimitsPerModel') {
        return {
          maxRequestsPerMinutePerModel: 100,
          maxTokensPerMinutePerModel: 1000,
        };
      }
      return null;
    });

    const result = await handleMessageRateLimiting(mockRequest, {
      organizationId: 'org-1',
      agentId: 'agent-1',
      messages: [],
      type: 'inference',
      lettaAgentsUserId: 'user-1',
    });

    expect(result.isRateLimited).toBe(true);
    expect(result.reasons).toContain('not-enough-credits');
  });

  it('should use purchased credits when available for pro users', async () => {
    const mockSubscription = {
      tier: 'pro',
      billingPeriodStart: Date.now(),
    };

    mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
    mockGetOrganizationCredits.mockResolvedValue(100); // Has purchased credits
    mockGetRemainingRecurrentCredits.mockResolvedValue(1001); // Recurrent credits exceeded (but should not matter)
    mockGetCreditCostPerModel.mockResolvedValue(1);

    getRedisData.mockImplementation((query, payload) => {
      if (query === 'modelNameAndEndpointToIdMap') {
        return { modelId: 'gpt-4-model-id' };
      }
      if (query === 'organizationToCoreOrganization') {
        return { coreOrganizationId: 'core-org-1' };
      }
      if (query === 'rpmWindow' || query === 'tpmWindow') {
        return { data: 0 };
      }
      if (query === 'deployedAgent') {
        return { isDeployed: false };
      }
      if (query === 'organizationRateLimitsPerModel') {
        return {
          maxRequestsPerMinutePerModel: 100,
          maxTokensPerMinutePerModel: 1000,
        };
      }
      return null;
    });

    const result = await handleMessageRateLimiting(mockRequest, {
      organizationId: 'org-1',
      agentId: 'agent-1',
      messages: [],
      type: 'inference',
      lettaAgentsUserId: 'user-1',
    });

    expect(result.isRateLimited).toBe(false);
    expect(mockGetOrganizationCredits).toHaveBeenCalledWith('org-1');
  });

  it('should still respect RPM and TPM limits for pro users', async () => {
    const mockSubscription = {
      tier: 'pro',
      billingPeriodStart: Date.now(),
    };

    mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
    mockGetOrganizationCredits.mockResolvedValue(100);
    mockGetRemainingRecurrentCredits.mockResolvedValue(5);
    mockGetCreditCostPerModel.mockResolvedValue(1);

    getRedisData.mockImplementation((query, payload) => {
      if (query === 'modelNameAndEndpointToIdMap') {
        return { modelId: 'gpt-4-model-id' };
      }
      if (query === 'organizationToCoreOrganization') {
        return { coreOrganizationId: 'core-org-1' };
      }
      if (query === 'rpmWindow') {
        return { data: 99 }; // At RPM limit
      }
      if (query === 'tpmWindow') {
        return { data: 0 };
      }
      if (query === 'deployedAgent') {
        return { isDeployed: false };
      }
      if (query === 'organizationRateLimitsPerModel') {
        return {
          maxRequestsPerMinutePerModel: 100,
          maxTokensPerMinutePerModel: 1000,
        };
      }
      return null;
    });

    const result = await handleMessageRateLimiting(mockRequest, {
      organizationId: 'org-1',
      agentId: 'agent-1',
      messages: [],
      type: 'inference',
      lettaAgentsUserId: 'user-1',
    });

    expect(result.isRateLimited).toBe(true);
    expect(result.reasons).toContain('requests');
  });

  it('should use legacy rate limiting for non-pro tiers', async () => {
    const mockSubscription = {
      tier: 'free',
      billingPeriodStart: Date.now(),
    };

    mockGetCustomerSubscription.mockResolvedValue(mockSubscription);
    mockGetOrganizationCredits.mockResolvedValue(0);
    mockGetCreditCostPerModel.mockResolvedValue(1);

    getRedisData.mockImplementation((query, payload) => {
      if (query === 'modelNameAndEndpointToIdMap') {
        return { modelId: 'gpt-4-model-id' };
      }
      if (query === 'organizationToCoreOrganization') {
        return { coreOrganizationId: 'core-org-1' };
      }
      if (query === 'rpmWindow' || query === 'tpmWindow') {
        return { data: 0 };
      }
      if (query === 'deployedAgent') {
        return { isDeployed: false };
      }
      if (query === 'organizationRateLimitsPerModel') {
        return {
          maxRequestsPerMinutePerModel: 100,
          maxTokensPerMinutePerModel: 1000,
        };
      }
      if (query === 'modelIdToModelTier') {
        return { tier: 'free' };
      }
      return null;
    });

    const result = await handleMessageRateLimiting(mockRequest, {
      organizationId: 'org-1',
      agentId: 'agent-1',
      messages: [],
      type: 'inference',
      lettaAgentsUserId: 'user-1',
    });

    // Should not call pro-specific functions
    expect(mockGetRemainingRecurrentCredits).not.toHaveBeenCalled();
  });

  it('should bypass rate limiting for BYOK agents', async () => {
    const byokAgent = {
      ...mockAgent,
      llm_config: {
        ...mockAgent.llm_config,
        provider_category: 'byok',
      },
    };

    mockAgentsService.retrieveAgent.mockResolvedValue(byokAgent as any);

    const mockSubscription = {
      tier: 'pro',
      billingPeriodStart: Date.now(),
    };

    mockGetCustomerSubscription.mockResolvedValue(mockSubscription);

    getRedisData.mockImplementation((query) => {
      if (query === 'deployedAgent') {
        return { isDeployed: false };
      }
      return null;
    });

    const result = await handleMessageRateLimiting(mockRequest, {
      organizationId: 'org-1',
      agentId: 'agent-1',
      messages: [],
      type: 'inference',
      lettaAgentsUserId: 'user-1',
    });

    expect(result.isRateLimited).toBe(false);
    expect(mockGetRemainingRecurrentCredits).not.toHaveBeenCalled();
    expect(mockGetOrganizationCredits).not.toHaveBeenCalled();
  });
});

import { getAndSeedOrganizationLimits } from '$web/server';
import { getRedisData, setRedisData } from '@letta-cloud/redis';
import { get } from 'lodash';
import { mockDatabase } from '@letta-cloud/database-testing';

jest.mock('@letta-cloud/redis', () => ({
  getRedisData: jest.fn(),
  setRedisData: jest.fn(),
}));

describe('getAndSeedOrganizationLimits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.only('should fetch limits from organizationLimits  ', async () => {
    getRedisData.mockImplementation((query, payload) => {
      if (
        query === 'organizationLimits' &&
        get(payload, 'organizationId') === '1'
      ) {
        return {
          maxRequestsPerMinutePerModel: {
            data: {
              chatgpt: 50,
            },
          },
          maxTokensPerMinutePerModel: {
            data: {
              chatgpt: 100,
            },
          },
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
      mockDatabase.query.organizationLimits.findFirst,
    ).not.toHaveBeenCalled();
    expect(setRedisData).not.toHaveBeenCalled();
    expect(response.maxRequestsPerMinutePerModel).toBe(50);
    expect(response.maxTokensPerMinutePerModel).toBe(100);
  });

  it('should populate limits from organizationLimits from database if not found in redis', async () => {
    getRedisData.mockResolvedValue(null);

    const organizationLimitResponse = {
      organizationId: '1',
      maxRequestsPerMinutePerModel: {
        version: '1',
        data: {
          chatgpt: 25,
        },
      },
      maxTokensPerMinutePerModel: {
        version: '1',
        data: {
          chatgpt: 95,
        },
      },
    };

    mockDatabase.query.organizationLimits.findFirst.mockResolvedValue(
      organizationLimitResponse,
    );

    const response = await getAndSeedOrganizationLimits({
      organizationId: '1',
      modelId: 'chatgpt',
      type: 'inference',
    });
    expect(setRedisData).toHaveBeenCalledWith(
      'organizationLimits',
      { organizationId: '1' },
      {
        expiresAt: expect.any(Number),
        data: {
          maxRequestsPerMinutePerModel:
            organizationLimitResponse.maxRequestsPerMinutePerModel,
          maxTokensPerMinutePerModel:
            organizationLimitResponse.maxTokensPerMinutePerModel,
        },
      },
    );
    expect(mockDatabase.query.organizationLimits.findFirst).toHaveBeenCalled();
    expect(response.maxRequestsPerMinutePerModel).toBe(25);
    expect(response.maxTokensPerMinutePerModel).toBe(95);
  });

  it('should get default limits if no organization limits for a specific model are not found', async () => {
    getRedisData.mockImplementation((query, payload) => {
      if (
        query === 'organizationLimits' &&
        get(payload, 'organizationId') === '1'
      ) {
        return {
          maxRequestsPerMinutePerModel: {
            data: {},
          },
          maxTokensPerMinutePerModel: {
            data: {},
          },
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
      mockDatabase.query.organizationLimits.findFirst,
    ).not.toHaveBeenCalled();
    expect(setRedisData).not.toHaveBeenCalled();
    expect(response.maxRequestsPerMinutePerModel).toBe(24);
    expect(response.maxTokensPerMinutePerModel).toBe(91);
  });

  it('should get default limits from database if not found in redis', async () => {
    getRedisData.mockImplementation((query, payload) => {
      if (
        query === 'organizationLimits' &&
        get(payload, 'modelId') === 'chatgpt' &&
        get(payload, 'organizationId') === '1'
      ) {
        return {
          maxRequestsPerMinutePerModel: {
            data: {},
          },
          maxTokensPerMinutePerModel: {
            data: {},
          },
        };
      }

      return null;
    });

    mockDatabase.query.organizationLimits.findFirst.mockResolvedValue(
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
    });

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
      mockDatabase.query.organizationLimits.findFirst,
    ).not.toHaveBeenCalled();
    expect(response.maxRequestsPerMinutePerModel).toBe(26);
    expect(response.maxTokensPerMinutePerModel).toBe(98);
    expect(
      mockDatabase.query.inferenceModelsMetadata.findFirst,
    ).toHaveBeenCalled();
  });
});

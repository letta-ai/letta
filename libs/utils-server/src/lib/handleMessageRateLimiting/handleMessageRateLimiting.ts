import { getRedisData, setRedisData } from '@letta-cloud/service-redis';
import {
  db,
  embeddingModelsMetadata,
  inferenceModelsMetadata,
  perModelPerOrganizationRateLimitOverrides,
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { AgentsService, type AgentState, type MessageCreate } from '@letta-cloud/sdk-core';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { getCreditCostPerModel } from '../getCreditCostPerModel/getCreditCostPerModel';
import { getOrganizationCredits } from '../redisOrganizationCredits/redisOrganizationCredits';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getRedisModelTransactions } from '../redisModelTransactions/redisModelTransactions';
import type { PaymentCustomerSubscription, RateLimitReason } from '@letta-cloud/types';
import { getCanAgentBeUsed } from './getCanAgentBeUsed/getCanAgentBeUsed';
import type { Request } from 'express';
import { getRemainingRecurrentCredits } from '../recurringCreditsManager/recurringCreditsManager';
import { getSingleFlag } from '@letta-cloud/service-feature-flags';
type ModelType = 'embedding' | 'inference';

interface IsRateLimitedForCreatingMessagesPayload {
  organizationId: string;
  messages: MessageCreate[];
  agentId: string;
  type: ModelType;
  lettaAgentsUserId: string;
}

interface GetAndSeedOrganizationLimitsResponse {
  maxRequestsPerMinutePerModel: number;
  maxTokensPerMinutePerModel: number;
}

interface GetAndSeedOrganizationLimitsPayload {
  modelId: string;
  organizationId: string;
  type: ModelType;
}

/*
 getAndSeedOrganizationLimits

  This function is responsible for getting and seeding organization limits.

  It first checks if the organization limits are already present in the Redis cache.
  If they are not present, it fetches them from the database for the given organizationId.
  If there are not associated limits for the organization, it fetches the default limits for the model from the database.
  If those dont exist, the model is unknown and the rate limit is set to 0.
 */
export async function getAndSeedOrganizationLimits(
  payload: GetAndSeedOrganizationLimitsPayload,
): Promise<GetAndSeedOrganizationLimitsResponse> {
  const { modelId, organizationId, type } = payload;
  const organizationLimit = await getRedisData(
    'organizationRateLimitsPerModel',
    {
      organizationId,
      modelId,
    },
  );

  let maxRequestsPerMinutePerModel: number | null | undefined =
    organizationLimit?.maxRequestsPerMinutePerModel;
  let maxTokensPerMinutePerModel: number | null | undefined =
    organizationLimit?.maxTokensPerMinutePerModel;

  // if organizationLimit exists but a specific model is not present, this most likley means that the organization limit for that model was not set, we do not want to fetch that here
  // we should rely on cache clearing to fetch the updated organization limits either by expiration or manual clearing else where
  if (!organizationLimit) {
    const response =
      await db.query.perModelPerOrganizationRateLimitOverrides.findFirst({
        where: eq(
          perModelPerOrganizationRateLimitOverrides.organizationId,
          organizationId,
        ),
      });

    if (response) {
      maxRequestsPerMinutePerModel = parseInt(
        response.maxRequestsPerMinute,
        10,
      );
      maxTokensPerMinutePerModel = parseInt(response.maxTokensPerMinute, 10);

      if (maxRequestsPerMinutePerModel && maxTokensPerMinutePerModel) {
        await setRedisData(
          'organizationRateLimitsPerModel',
          { organizationId, modelId },
          {
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            data: {
              maxRequestsPerMinutePerModel,
              maxTokensPerMinutePerModel,
            },
          },
        );
      }
    }
  }

  if (!maxRequestsPerMinutePerModel || !maxTokensPerMinutePerModel) {
    // fetch from root limits
    const [defaultModelRequestPerMinute, defaultModelTokensPerMinute] =
      await Promise.all([
        getRedisData('defaultModelRequestPerMinute', { modelId }),
        getRedisData('defaultModelTokensPerMinute', { modelId }),
      ]);

    maxRequestsPerMinutePerModel =
      defaultModelRequestPerMinute?.maxRequestsPerMinute;
    maxTokensPerMinutePerModel =
      defaultModelTokensPerMinute?.maxTokensPerMinute;

    if (!maxRequestsPerMinutePerModel || !maxTokensPerMinutePerModel) {
      const dbDefault = await (type === 'inference'
        ? db.query.inferenceModelsMetadata.findFirst({
            where: eq(inferenceModelsMetadata.id, modelId),
            columns: {
              defaultTokensPerMinutePerOrganization: true,
              defaultRequestsPerMinutePerOrganization: true,
            },
          })
        : db.query.embeddingModelsMetadata.findFirst({
            where: eq(embeddingModelsMetadata.id, modelId),
            columns: {
              defaultTokensPerMinutePerOrganization: true,
              defaultRequestsPerMinutePerOrganization: true,
            },
          }));

      maxRequestsPerMinutePerModel =
        parseInt(
          dbDefault?.defaultRequestsPerMinutePerOrganization || '0',
          10,
        ) || 0;
      maxTokensPerMinutePerModel =
        parseInt(dbDefault?.defaultTokensPerMinutePerOrganization || '0', 10) ||
        0;

      await Promise.all([
        setRedisData(
          'defaultModelRequestPerMinute',
          { modelId },
          {
            data: {
              maxRequestsPerMinute: maxRequestsPerMinutePerModel,
            },
          },
        ),
        setRedisData(
          'defaultModelTokensPerMinute',
          { modelId },
          {
            data: {
              maxTokensPerMinute: maxTokensPerMinutePerModel,
            },
          },
        ),
      ]);
    }
  }

  return {
    maxRequestsPerMinutePerModel: maxRequestsPerMinutePerModel || 0,
    maxTokensPerMinutePerModel: maxTokensPerMinutePerModel || 0,
  };
}

/*
  handleMessageRateLimiting

  This function is responsible for handling rate limiting for creating messages.

  We use a sliding window algorithm to track the number of requests and tokens per minute.

  If the number of requests or tokens exceeds the rate limit, we return a response indicating that the request is rate limited.
 */

function isANumberSafe(num: any) {
  return typeof num === 'number' && !isNaN(num) && isFinite(num);
}

interface HandleRateLimitingPayload {
  agent: AgentState;
  organizationId: string;
  usageLimits: ReturnType<typeof getUsageLimits>;
  type: ModelType;
}

async function handleLegacyRateLimiting(
  payload: HandleRateLimitingPayload,
) {
  const { agent, organizationId, usageLimits, type } = payload;
  const [modelMetaData, coreOrganization] = await Promise.all([
    getRedisData('modelNameAndEndpointToIdMap', {
      modelName: agent.llm_config.model,
      modelEndpoint: agent.llm_config.model_endpoint || '',
    }),
    getRedisData('organizationToCoreOrganization', {
      organizationId,
    }),
  ]);

  if (!modelMetaData || !coreOrganization?.coreOrganizationId) {
    return {
      isRateLimited: true,
      reasons: ['model-unknown'],
    };
  }

  const inputTokens = 1;
  const modelId = modelMetaData.modelId;

  const currentMinute = Math.floor(Date.now() / 60000);

  const { maxRequestsPerMinutePerModel, maxTokensPerMinutePerModel } =
    await getAndSeedOrganizationLimits({ organizationId, modelId, type });

  const result = await Promise.all([
    getRedisData('rpmWindow', {
      modelId,
      organizationId,
      minute: currentMinute,
    }),
    getRedisData('tpmWindow', {
      modelId,
      organizationId,
      minute: currentMinute,
    }),
    getOrganizationCredits(organizationId),
    getCreditCostPerModel({
      modelName: agent.llm_config.model,
      modelEndpoint: agent.llm_config.model_endpoint || '',
      contextWindowSize: inputTokens,
    }),
    getRedisData('modelIdToModelTier', {
      modelId: modelId,
    }),

    getRedisModelTransactions('free', organizationId),
    getRedisModelTransactions('premium', organizationId),
  ]);

  const currentRequests =
    result[0] && isANumberSafe(result[0]?.data) ? result[0].data : 0;
  const currentTokens =
    result[1] && isANumberSafe(result[1]?.data) ? result[1].data : 0;
  const organizationCredits =
    result[2] && isANumberSafe(result[2]) ? result[2] : 0;
  const creditCost = result[3];

  const modelTierInformation = result[4]?.tier || 'free';
  const freeUsage = result[5] || 0;
  const premiumUsage = result[6] || 0;

  const rateLimitThresholds: RateLimitReason[] = [];

  // if you have no credits, you are rate limited by the free/premium limits
  if (
    organizationCredits <= 0 &&
    ['free', 'premium'].includes(modelTierInformation)
  ) {
    if (modelTierInformation === 'free') {
      if (freeUsage + 1 > usageLimits.freeInferencesPerMonth) {
        rateLimitThresholds.push('free-usage-exceeded');
      }
    } else if (modelTierInformation === 'premium') {
      if (premiumUsage + 1 > usageLimits.premiumInferencesPerMonth) {
        rateLimitThresholds.push('premium-usage-exceeded');
      }
    }
  } else {
    // if you have credits, you are rate limited by the model limits
    if (typeof creditCost !== 'number') {
      rateLimitThresholds.push('context-window-size-not-supported');
    } else if (organizationCredits - creditCost < 0) {
      rateLimitThresholds.push('not-enough-credits');
    }
  }

  if (currentRequests + 1 >= maxRequestsPerMinutePerModel) {
    rateLimitThresholds.push('requests');
  }

  if (currentTokens + inputTokens >= maxTokensPerMinutePerModel) {
    rateLimitThresholds.push('tokens');
  }

  if (rateLimitThresholds.length) {
    return {
      isRateLimited: true,
      reasons: rateLimitThresholds,
    };
  }

  await Promise.all([
    setRedisData(
      'rpmWindow',
      { modelId, organizationId, minute: currentMinute },
      {
        // expires in 3 minutes
        expiresAt: Date.now() + 3 * 60000,
        data: { data: currentRequests + 1 },
      },
    ),
    setRedisData(
      'tpmWindow',
      { modelId, organizationId, minute: currentMinute },
      {
        // expires in 3 minutes
        expiresAt: Date.now() + 3 * 60000,
        data: { data: currentTokens + inputTokens },
      },
    ),
  ]);

  return {
    isRateLimited: false,
  };
}


interface HandleNewRateLimitingPayload {
  agent: AgentState;
  organizationId: string;
  type: ModelType;
  subscription: PaymentCustomerSubscription
}

async function handleNewRateLimiting(
  payload: HandleNewRateLimitingPayload,
) {
  const { agent, organizationId, type, subscription } = payload;

  const [modelMetaData, coreOrganization] = await Promise.all([
    getRedisData('modelNameAndEndpointToIdMap', {
      modelName: agent.llm_config.model,
      modelEndpoint: agent.llm_config.model_endpoint || '',
    }),
    getRedisData('organizationToCoreOrganization', {
      organizationId,
    }),
  ]);

  if (!modelMetaData || !coreOrganization?.coreOrganizationId) {
    return {
      isRateLimited: true,
      reasons: ['model-unknown'],
    };
  }

  const inputTokens = 1;
  const modelId = modelMetaData.modelId;

  const currentMinute = Math.floor(Date.now() / 60000);

  const { maxRequestsPerMinutePerModel, maxTokensPerMinutePerModel } =
    await getAndSeedOrganizationLimits({ organizationId, modelId, type });

  const result = await Promise.all([
    getRedisData('rpmWindow', {
      modelId,
      organizationId,
      minute: currentMinute,
    }),
    getRedisData('tpmWindow', {
      modelId,
      organizationId,
      minute: currentMinute,
    }),
    getOrganizationCredits(organizationId),
    getCreditCostPerModel({
      modelName: agent.llm_config.model,
      modelEndpoint: agent.llm_config.model_endpoint || '',
      contextWindowSize: inputTokens,
    }),
    getRemainingRecurrentCredits(organizationId, subscription)
  ]);

  const currentRequests =
    result[0] && isANumberSafe(result[0]?.data) ? result[0].data : 0;
  const currentTokens =
    result[1] && isANumberSafe(result[1]?.data) ? result[1].data : 0;
  const organizationCredits =
    result[2] && isANumberSafe(result[2]) ? result[2] : 0;
  const creditCost = result[3] && isANumberSafe(result[3]) ? result[3] : 0;
  const remainingCredits = result[4] && isANumberSafe(result[4]) ? result[4] : 0;

  const rateLimitThresholds: RateLimitReason[] = [];

  // if you have no credits, you are rate limited by the free/premium limits
  if (
    organizationCredits <= 0
  ) {
    if (remainingCredits - creditCost < 0) {
      rateLimitThresholds.push('not-enough-credits');
    }
  } else {
    // if you have credits, you are rate limited by the model limits
    if (typeof creditCost !== 'number') {
      rateLimitThresholds.push('context-window-size-not-supported');
    } else if (organizationCredits - creditCost < 0) {
      rateLimitThresholds.push('not-enough-credits');
    }
  }

  if (currentRequests + 1 >= maxRequestsPerMinutePerModel) {
    rateLimitThresholds.push('requests');
  }

  if (currentTokens + inputTokens >= maxTokensPerMinutePerModel) {
    rateLimitThresholds.push('tokens');
  }

  if (rateLimitThresholds.length) {
    return {
      isRateLimited: true,
      reasons: rateLimitThresholds,
    };
  }

  await Promise.all([
    setRedisData(
      'rpmWindow',
      { modelId, organizationId, minute: currentMinute },
      {
        // expires in 3 minutes
        expiresAt: Date.now() + 3 * 60000,
        data: { data: currentRequests + 1 },
      },
    ),
    setRedisData(
      'tpmWindow',
      { modelId, organizationId, minute: currentMinute },
      {
        // expires in 3 minutes
        expiresAt: Date.now() + 3 * 60000,
        data: { data: currentTokens + inputTokens },
      },
    ),
  ]);

  return {
    isRateLimited: false,
  };
}


export async function handleMessageRateLimiting(
  req: Request,
  payload: IsRateLimitedForCreatingMessagesPayload,
) {
  const { organizationId, agentId, type, lettaAgentsUserId } = payload;

  const agent = await AgentsService.retrieveAgent(
    {
      agentId,
      includeRelationships: [],
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  req.headers['x-agent-id'] = agentId;

  if (agent.project_id) {
    req.headers['x-project-id'] = agent.project_id;
  }

  if (agent.template_id) {
    req.headers['x-template-id'] = agent.template_id;
  }

  if (agent.base_template_id) {
    req.headers['x-base-template-id'] = agent.base_template_id;
  }

  if (!agent) {
    return {
      isRateLimited: true,
      reasons: ['agent-not-found'],
    };
  }

  const subscription = await getCustomerSubscription(organizationId);

  const usageLimits = getUsageLimits(subscription.tier);

  const isDeployedAgent = await getRedisData('deployedAgent', {
    agentId,
  });

  const canAgentBeUsed =
    !isDeployedAgent?.isDeployed ||
    (await getCanAgentBeUsed({
      agentId,
      baseTemplateId: agent.base_template_id || '',
      organizationId,
      agentLimit: usageLimits.agents,
      billingPeriodStart: subscription.billingPeriodStart,
    }));

  if (!canAgentBeUsed) {
    return {
      isRateLimited: true,
      reasons: ['agents-limit-exceeded'],
    };
  }

  const isByok = agent.llm_config.provider_category === 'byok';

  if (isByok) {
    return {
      isRateLimited: false,
    };
  }

  if (subscription.tier === 'pro') {
    return await handleNewRateLimiting({
      agent,
      organizationId,
      type,
      subscription
    });
  }

  if (subscription.tier === 'free') {
    const newBilling = await getSingleFlag('BILLING_V3', organizationId);

    if (newBilling) {
      return await handleNewRateLimiting({
        agent,
        organizationId,
        type,
        subscription
      });
    }

    return await handleLegacyRateLimiting({
      agent,
      organizationId,
      usageLimits,
      type,
    });
  }

  return await handleLegacyRateLimiting({
    agent,
    organizationId,
    usageLimits,
    type,
  });
}

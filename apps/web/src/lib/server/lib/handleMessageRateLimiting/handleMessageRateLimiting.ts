import { getRedisData, setRedisData } from '@letta-cloud/redis';
import {
  db,
  embeddingModelsMetadata,
  inferenceModelsMetadata,
  perModelPerOrganizationRateLimitOverrides,
} from '@letta-cloud/database';
import { and, eq } from 'drizzle-orm';
import { AgentsService } from '@letta-cloud/letta-agents-api';
import type { LettaStreamingRequest } from '@letta-cloud/letta-agents-api';
import { getTikTokenEncoder } from '@letta-cloud/generic-utils';

type ModelType = 'embedding' | 'inference';

interface IsRateLimitedForCreatingMessagesPayload {
  organizationId: string;
  input: LettaStreamingRequest;
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

  console.log('a', organizationLimit);
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
export type RateLimitReason = 'model-unknown' | 'requests' | 'tokens';

function isANumberSafe(num: any) {
  return typeof num === 'number' && !isNaN(num) && isFinite(num);
}

export async function handleMessageRateLimiting(
  payload: IsRateLimitedForCreatingMessagesPayload,
) {
  const { organizationId, input, agentId, type, lettaAgentsUserId } = payload;

  const agent = await AgentsService.retrieveAgent(
    {
      agentId,
    },
    {
      user_id: lettaAgentsUserId,
    },
  );

  if (!agent) {
    return {
      isRateLimited: true,
      reasons: ['model-unknown'],
    };
  }

  const metaData = await db.query.inferenceModelsMetadata.findFirst({
    where: and(
      eq(inferenceModelsMetadata.modelName, agent.llm_config.model),
      eq(
        inferenceModelsMetadata.modelEndpoint,
        agent.llm_config.model_endpoint || '',
      ),
    ),
  });

  if (!metaData) {
    return {
      isRateLimited: true,
      reasons: ['model-unknown'],
    };
  }

  const encoding = getTikTokenEncoder(agent.llm_config.model);

  const inputTokens = input.messages.reduce((acc, message) => {
    let text = '';

    if (Array.isArray(message.content)) {
      text = message.content.map((c) => c.text).join(' ');
    } else {
      text = message.content;
    }

    const tokenLength = encoding.encode(text).length;

    return acc + tokenLength;
  }, 0);

  const modelId = metaData.id;

  console.log('a', modelId);
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
  ]);

  const currentRequests =
    result[0] && isANumberSafe(result[0]?.data) ? result[0].data : 0;
  const currentTokens =
    result[1] && isANumberSafe(result[1]?.data) ? result[1].data : 0;

  const rateLimitThresholds: RateLimitReason[] = [];

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

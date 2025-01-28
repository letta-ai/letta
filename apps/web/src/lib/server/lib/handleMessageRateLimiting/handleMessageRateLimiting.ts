import { getRedisData, setRedisData } from '@letta-cloud/redis';
import {
  db,
  embeddingModelsMetadata,
  inferenceModelsMetadata,
  organizationLimits,
} from '@letta-cloud/database';
import { eq } from 'drizzle-orm';

type ModelType = 'embedding' | 'inference';

interface IsRateLimitedForCreatingMessagesPayload {
  organizationId: string;
  inputTokens: string;
  modelId: string;
  type: ModelType;
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
  const organizationLimit = await getRedisData('organizationLimits', {
    organizationId,
  });

  let maxRequestsPerMinuteForModel: number | null | undefined =
    organizationLimit?.maxRequestsPerMinutePerModel?.data[modelId];
  let maxTokensPerMinuteForModel: number | null | undefined =
    organizationLimit?.maxTokensPerMinutePerModel?.data[modelId];

  // if organizationLimit exists but a specific model is not present, this most likley means that the organization limit for that model was not set, we do not want to fetch that here
  // we should rely on cache clearing to fetch the updated organization limits either by expiration or manual clearing else where
  if (!organizationLimit) {
    const response = await db.query.organizationLimits.findFirst({
      where: eq(organizationLimits.organizationId, organizationId),
    });

    if (!response) {
      throw new Error('Organization limits not found');
    }

    maxRequestsPerMinuteForModel =
      response.maxRequestsPerMinutePerModel?.data[modelId];
    maxTokensPerMinuteForModel =
      response.maxTokensPerMinutePerModel?.data[modelId];

    await setRedisData(
      'organizationLimits',
      { organizationId },
      {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        data: {
          maxRequestsPerMinutePerModel: response.maxRequestsPerMinutePerModel,
          maxTokensPerMinutePerModel: response.maxTokensPerMinutePerModel,
        },
      },
    );
  }

  if (!maxRequestsPerMinuteForModel || !maxTokensPerMinuteForModel) {
    // fetch from root limits
    const [defaultModelRequestPerMinute, defaultModelTokensPerMinute] =
      await Promise.all([
        getRedisData('defaultModelRequestPerMinute', { modelId }),
        getRedisData('defaultModelTokensPerMinute', { modelId }),
      ]);

    maxRequestsPerMinuteForModel =
      defaultModelRequestPerMinute?.maxRequestsPerMinute;
    maxTokensPerMinuteForModel =
      defaultModelTokensPerMinute?.maxTokensPerMinute;

    if (!maxRequestsPerMinuteForModel || !maxTokensPerMinuteForModel) {
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

      maxRequestsPerMinuteForModel =
        parseInt(
          dbDefault?.defaultRequestsPerMinutePerOrganization || '0',
          10,
        ) || 0;
      maxTokensPerMinuteForModel =
        parseInt(dbDefault?.defaultTokensPerMinutePerOrganization || '0', 10) ||
        0;

      await Promise.all([
        setRedisData(
          'defaultModelRequestPerMinute',
          { modelId },
          {
            data: {
              maxRequestsPerMinute: maxRequestsPerMinuteForModel,
            },
          },
        ),
        setRedisData(
          'defaultModelTokensPerMinute',
          { modelId },
          {
            data: {
              maxTokensPerMinute: maxTokensPerMinuteForModel,
            },
          },
        ),
      ]);
    }
  }

  return {
    maxRequestsPerMinutePerModel: maxRequestsPerMinuteForModel || 0,
    maxTokensPerMinutePerModel: maxTokensPerMinuteForModel || 0,
  };
}

/*
  handleMessageRateLimiting

  This function is responsible for handling rate limiting for creating messages.

  We use a sliding window algorithm to track the number of requests and tokens per minute.

  If the number of requests or tokens exceeds the rate limit, we return a response indicating that the request is rate limited.
 */
export type RateLimitReason = 'requests' | 'tokens';

function isANumberSafe(num: any) {
  return typeof num === 'number' && !isNaN(num) && isFinite(num);
}

export async function handleMessageRateLimiting(
  payload: IsRateLimitedForCreatingMessagesPayload,
) {
  const { organizationId, inputTokens, modelId, type } = payload;

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

  if (currentRequests >= maxRequestsPerMinutePerModel) {
    rateLimitThresholds.push('requests');
  }

  if (currentTokens >= maxTokensPerMinutePerModel) {
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
        data: { data: currentTokens + inputTokens.length },
      },
    ),
  ]);

  return {
    isRateLimited: false,
  };
}

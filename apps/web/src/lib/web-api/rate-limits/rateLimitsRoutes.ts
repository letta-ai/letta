import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts, RateLimit } from '@letta-cloud/sdk-web';
import {
  db,
  inferenceModelsMetadata,
  perModelPerOrganizationRateLimitOverrides,
} from '@letta-cloud/service-database';
import { and, eq, ilike, inArray, isNull } from 'drizzle-orm';
import { getUser } from '$web/server/auth';

type GetInferenceRateLimitsRequest = ServerInferRequest<
  typeof contracts.rateLimits.getInferenceRateLimits
>;

type GetInferenceRateLimitsResponse = ServerInferResponses<
  typeof contracts.rateLimits.getInferenceRateLimits
>;

async function getInferenceRateLimits(
  req: GetInferenceRateLimitsRequest,
): Promise<GetInferenceRateLimitsResponse> {
  const { search, limit = 5, offset = 0 } = req.query;

  const user = await getUser();

  const inferenceModels = await db.query.inferenceModelsMetadata.findMany({
    where: and(
      ...(search ? [ilike(inferenceModelsMetadata.name, `%${search}%`)] : []),
      isNull(inferenceModelsMetadata.disabledAt),
    ),
    offset,
    limit: limit + 1,
    columns: {
      id: true,
      name: true,
      defaultRequestsPerMinutePerOrganization: true,
      defaultTokensPerMinutePerOrganization: true,
    },
  });

  const rateLimitsMap = new Map<string, RateLimit>();

  inferenceModels.forEach((model) => {
    rateLimitsMap.set(model.id, {
      model: model.name,
      requestsPerMinute: parseInt(
        model.defaultRequestsPerMinutePerOrganization,
        10,
      ),
      tokensPerMinute: parseInt(
        model.defaultTokensPerMinutePerOrganization,
        10,
      ),
    });
  });

  if (user?.activeOrganizationId) {
    const overrides =
      await db.query.perModelPerOrganizationRateLimitOverrides.findMany({
        where: and(
          eq(
            perModelPerOrganizationRateLimitOverrides.organizationId,
            user.activeOrganizationId,
          ),
          inArray(
            perModelPerOrganizationRateLimitOverrides.modelId,
            inferenceModels.map((m) => m.id),
          ),
        ),
      });

    overrides.forEach((override) => {
      rateLimitsMap.set(override.modelId, {
        model: override.modelId,
        requestsPerMinute: parseInt(override.maxRequestsPerMinute, 10),
        tokensPerMinute: parseInt(override.maxTokensPerMinute, 10),
      });
    });
  }

  return {
    status: 200,
    body: {
      rateLimits: Array.from(rateLimitsMap.values()).slice(0, limit),
      hasNextPage: inferenceModels.length > limit,
    },
  };
}

type GetEmbeddingRateLimitsRequest = ServerInferRequest<
  typeof contracts.rateLimits.getEmbeddingRateLimits
>;

type GetEmbeddingRateLimitsResponse = ServerInferResponses<
  typeof contracts.rateLimits.getEmbeddingRateLimits
>;

async function getEmbeddingRateLimits(
  req: GetEmbeddingRateLimitsRequest,
): Promise<GetEmbeddingRateLimitsResponse> {
  const { search, limit = 5, offset = 0 } = req.query;

  const user = await getUser();

  const embeddings = await db.query.embeddingModelsMetadata.findMany({
    where: and(
      ...(search ? [ilike(inferenceModelsMetadata.name, `%${search}%`)] : []),
      isNull(inferenceModelsMetadata.disabledAt),
    ),
    offset,
    limit: limit + 1,
    columns: {
      id: true,
      name: true,
      defaultRequestsPerMinutePerOrganization: true,
      defaultTokensPerMinutePerOrganization: true,
    },
  });

  const rateLimitsMap = new Map<string, RateLimit>();

  embeddings.forEach((model) => {
    rateLimitsMap.set(model.id, {
      model: model.name,
      requestsPerMinute: parseInt(
        model.defaultRequestsPerMinutePerOrganization,
        10,
      ),
      tokensPerMinute: parseInt(
        model.defaultTokensPerMinutePerOrganization,
        10,
      ),
    });
  });

  if (user?.activeOrganizationId) {
    const overrides =
      await db.query.perModelPerOrganizationRateLimitOverrides.findMany({
        where: and(
          eq(
            perModelPerOrganizationRateLimitOverrides.organizationId,
            user.activeOrganizationId,
          ),
          inArray(
            perModelPerOrganizationRateLimitOverrides.modelId,
            embeddings.map((m) => m.id),
          ),
        ),
      });

    overrides.forEach((override) => {
      rateLimitsMap.set(override.modelId, {
        model: override.modelId,
        requestsPerMinute: parseInt(override.maxRequestsPerMinute, 10),
        tokensPerMinute: parseInt(override.maxTokensPerMinute, 10),
      });
    });
  }

  return {
    status: 200,
    body: {
      rateLimits: Array.from(rateLimitsMap.values()).slice(0, limit),
      hasNextPage: embeddings.length > limit,
    },
  };
}

export const rateLimitsRoutes = {
  getInferenceRateLimits,
  getEmbeddingRateLimits,
};

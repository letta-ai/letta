import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/web-api-client';
import { db, inferenceModelsMetadata } from '@letta-cloud/database';
import { and, eq, ilike, isNull } from 'drizzle-orm';

type GetStepCostsRequest = ServerInferRequest<
  typeof contracts.costs.getStepCosts
>;

type GetStepCostsResponse = ServerInferResponses<
  typeof contracts.costs.getStepCosts
>;

async function getStepCosts(
  req: GetStepCostsRequest,
): Promise<GetStepCostsResponse> {
  const { search, limit = 5, offset = 0 } = req.query;

  const inferenceModels = await db.query.inferenceModelsMetadata.findMany({
    where: and(
      ...[
        ...(search ? [ilike(inferenceModelsMetadata.name, `%${search}%`)] : []),
        isNull(inferenceModelsMetadata.disabledAt),
      ],
    ),
    with: {
      stepCostSchema: true,
    },
    offset,
    limit: limit + 1,
    columns: {
      id: true,
      name: true,
      defaultRequestsPerMinutePerOrganization: true,
      defaultTokensPerMinutePerOrganization: true,
    },
  });

  return {
    status: 200,
    body: {
      stepCosts: inferenceModels.map((model) => {
        return {
          modelId: model.id,
          modelName: model.name,
          costMap: model.stepCostSchema.stepCostSchema.data.reduce(
            (acc, cost) => {
              acc[`${cost.maxContextWindowSize}`] = cost.cost;
              return acc;
            },
            {} as Record<string, number>,
          ),
        };
      }),
      hasNextPage: inferenceModels.length > limit,
    },
  };
}

type GetStepCostByModelIdRequest = ServerInferRequest<
  typeof contracts.costs.getStepCostByModelId
>;

type GetStepCostByModelIdResponse = ServerInferResponses<
  typeof contracts.costs.getStepCostByModelId
>;

async function getStepCostByModelId(
  req: GetStepCostByModelIdRequest,
): Promise<GetStepCostByModelIdResponse> {
  const { modelId } = req.params;

  const inferenceModel = await db.query.inferenceModelsMetadata.findFirst({
    where: eq(inferenceModelsMetadata.id, modelId),
    with: {
      stepCostSchema: true,
    },
    columns: {
      id: true,
      name: true,
      defaultRequestsPerMinutePerOrganization: true,
      defaultTokensPerMinutePerOrganization: true,
    },
  });

  if (!inferenceModel) {
    return {
      status: 404,
      body: {
        message: 'Inference model not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      modelId: inferenceModel.id,
      modelName: inferenceModel.name,
      costMap: inferenceModel.stepCostSchema.stepCostSchema.data.reduce(
        (acc, cost) => {
          acc[`${cost.maxContextWindowSize}`] = cost.cost;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
  };
}

export const costsRoutes = {
  getStepCosts,
  getStepCostByModelId,
};

import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import { db, inferenceModelsMetadata } from '@letta-cloud/service-database';
import { eq, isNull } from 'drizzle-orm';
import { ModelsService } from '@letta-cloud/sdk-core';

type GetStepCostsResponse = ServerInferResponses<
  typeof contracts.costs.getStepCosts
>;

async function getStepCosts(): Promise<GetStepCostsResponse> {
  const [inferenceModels, llmBackends] = await Promise.all([
    db.query.inferenceModelsMetadata.findMany({
      where: isNull(inferenceModelsMetadata.disabledAt),
      with: {
        stepCostSchema: true,
      },
      columns: {
        id: true,
        name: true,
        brand: true,
        tier: true,
        modelName: true,
        modelEndpoint: true,
        defaultRequestsPerMinutePerOrganization: true,
        defaultTokensPerMinutePerOrganization: true,
      },
    }),
    ModelsService.listModels({
      providerCategory: ['base'],
    }),
  ]);

  const llmBackendsSet = new Set(
    llmBackends.map((m) => `${m.model}:${m.model_endpoint}`),
  );

  return {
    status: 200,
    body: {
      stepCosts: inferenceModels
        .filter((m) => llmBackendsSet.has(`${m.modelName}:${m.modelEndpoint}`))
        .map((model) => {
          return {
            modelId: model.id,
            modelName: model.name,
            brand: model.brand,
            tier: model.tier,
            costMap: model.stepCostSchema.stepCostSchema.data.reduce(
              (acc, cost) => {
                acc[`${cost.maxContextWindowSize}`] = cost.cost;
                return acc;
              },
              {} as Record<string, number>,
            ),
          };
        }),
      hasNextPage: false,
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
      brand: true,
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
      brand: inferenceModel.brand,
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

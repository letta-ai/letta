import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import { type ListModelsResponse, ModelsService } from '@letta-cloud/sdk-core';
import { db, inferenceModelsMetadata } from '@letta-cloud/service-database';
import { isNull } from 'drizzle-orm';
import { DEFAULT_EMBEDDING_MODEL } from '@letta-cloud/types';
import { getContextDataHack } from '../getContextDataHack/getContextDataHack';
import type { SDKContext } from '../types';

type ListLLMModelsRequest = ServerInferRequest<
  typeof cloudContracts.models.listLLMModels
>;

type ListLLMModelsResponse = ServerInferResponses<
  typeof cloudContracts.models.listLLMModels
>;

async function listLLMModels(
  req: ListLLMModelsRequest,
  context: SDKContext,
): Promise<ListLLMModelsResponse> {
  const { lettaAgentsUserId } = getContextDataHack(req, context);
  const { provider_category } = req.query;

  if (!lettaAgentsUserId) {
    return {
      status: 401,
      body: {
        error: 'Unauthorized',
      },
    };
  }

  if (provider_category && !provider_category.includes('base')) {
    const byokModels = await ModelsService.listModels(
      {
        ...req.query,
        providerCategory: ['byok'],
      },
      {
        user_id: lettaAgentsUserId,
      },
    );

    return {
      status: 200,
      body: byokModels,
    };
  }

  const [llmBackends, inferenceModelMetaData, byokModels] = await Promise.all([
    ModelsService.listModels({
      ...req.query,
      providerCategory: ['base'],
    }),
    db.query.inferenceModelsMetadata.findMany({
      where: isNull(inferenceModelsMetadata.disabledAt),
      columns: {
        id: true,
        modelEndpoint: true,
        defaultContextWindow: true,
        modelName: true,
        name: true,
        tier: true,
        brand: true,
      },
    }),
    ...(!provider_category || provider_category.includes('byok')
      ? [
          ModelsService.listModels(
            {
              ...req.query,
              providerCategory: ['byok'],
            },
            {
              user_id: lettaAgentsUserId,
            },
          ).catch((_) => {
            // do nothing if the user doesn't have access to the models
            return [] as ListModelsResponse;
          }),
        ]
      : []),
  ]);

  // only return llmBackends that are not disabled
  // and also the byokModels
  const availableModelMap = new Map();

  inferenceModelMetaData.forEach((m) => {
    availableModelMap.set(`${m.modelEndpoint}:${m.modelName}`, m);
  });

  const filteredLLMBackends = llmBackends
    .filter((m) => availableModelMap.has(`${m.model_endpoint}:${m.model}`))
    .map((model) => {
      // let's remap model to be the name
      const meta = availableModelMap.get(
        `${model.model_endpoint}:${model.model}`,
      );

      const defaultContextWindow =
        meta?.defaultContextWindow &&
        !isNaN(parseInt(meta.defaultContextWindow, 10))
          ? parseInt(meta.defaultContextWindow, 10)
          : model.context_window;

      return {
        ...model,
        model: meta ? meta.name : model.model,
        context_window: defaultContextWindow || model.context_window,
        tier: meta?.tier,
      };
    });

  return {
    status: 200,
    body: [...filteredLLMBackends, ...(byokModels || [])],
  };
}

type ListEmbeddingModelsResponse = ServerInferResponses<
  typeof cloudContracts.models.listEmbeddingModels
>;

async function listEmbeddingModels(): Promise<ListEmbeddingModelsResponse> {
  return {
    body: [
      {
        embedding_endpoint_type: 'openai',
        embedding_endpoint: 'https://api.openai.com/v1',
        embedding_model: 'text-embedding-3-small',
        embedding_dim: 2000,
        embedding_chunk_size: 300,
        handle: DEFAULT_EMBEDDING_MODEL,
        batch_size: 1024,
        azure_endpoint: null,
        azure_version: null,
        azure_deployment: null,
      },
    ],
    status: 200,
  };
}

export const modelsRouter = {
  listLLMModels,
  listEmbeddingModels,
};

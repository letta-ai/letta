import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getAdminInferenceModels,
  getAdminEmbeddingModels,
} from '../admin/models/adminModelsRouter';
import { type ListModelsResponse, ModelsService } from '@letta-cloud/sdk-core';
import { getUser } from '$web/server/auth';

type ListLLMBackendsResponseType = ServerInferResponses<
  typeof contracts.models.listInferenceModels
>;

async function listInferenceModels(): Promise<ListLLMBackendsResponseType> {
  const user = await getUser();

  if (!user) {
    return {
      status: 401,
      body: {
        error: 'Unauthorized',
      },
    };
  }

  const [llmBackends, byokModels] = await Promise.all([
    getAdminInferenceModels({
      query: {
        limit: 250,
        disabled: false,
      },
    }),
    ModelsService.listModels(
      {
        providerCategory: ['byok'],
      },
      {
        user_id: user.lettaAgentsId,
      },
    ).catch((_) => {
      // do nothing if the user doesn't have access to the models
      return [] as ListModelsResponse;
    }),
  ]);

  if (llmBackends.status !== 200) {
    return {
      status: 500,
      body: {
        error: 'Failed to get LLM backends',
      },
    };
  }

  const parsedByokModels = byokModels.map((model) => {
    return {
      ...model,
      brand: model.model_endpoint_type,
      id: model.handle || '',
      displayName: model.handle || '',
      type: 'byok' as const,
    };
  });

  const lettaModels = llmBackends.body.inferenceModels
    .filter((model) => !!model.config)
    .map((model) => {
      return {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ...model.config!,
        id: model.id,
        brand: model.brand,
        context_window:
          model.defaultContextWindow || model.config!.context_window,
        displayName: model.name || '',
        type: 'letta' as const,
        tier: model.tier,
      };
    });

  return {
    status: 200,
    body: [...lettaModels, ...parsedByokModels],
  };
}

type ListEmbeddingBackendsResponseType = ServerInferResponses<
  typeof contracts.models.listEmbeddingModels
>;

async function listEmbeddingModels(): Promise<ListEmbeddingBackendsResponseType> {
  const embeddingBackends = await getAdminEmbeddingModels({
    query: {
      limit: 250,
      disabled: false,
    },
  });

  if (embeddingBackends.status !== 200) {
    return {
      status: 500,
      body: {
        error: 'Failed to get embedding backends',
      },
    };
  }

  return {
    status: 200,
    body: embeddingBackends.body.embeddingModels
      .filter((model) => !!model.config)
      .map((model) => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ...model.config!,
          brand: model.brand,
        };
      }),
  };
}

export const modelsRouter = {
  listInferenceModels,
  listEmbeddingModels,
};

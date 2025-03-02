import type { ServerInferResponses } from '@ts-rest/core';
import { router } from '$web/web-api/router';
import type { contracts } from '@letta-cloud/web-api-client';

type ListLLMBackendsResponseType = ServerInferResponses<
  typeof contracts.models.listInferenceModels
>;

async function listInferenceModels(): Promise<ListLLMBackendsResponseType> {
  const llmBackends = await router.admin.models.getAdminInferenceModels({
    query: {
      limit: 250,
      disabled: false,
    },
  });

  if (llmBackends.status !== 200) {
    return {
      status: 500,
      body: {
        error: 'Failed to get LLM backends',
      },
    };
  }

  return {
    status: 200,
    body: llmBackends.body.inferenceModels
      .filter((model) => !!model.config)
      .map((model) => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ...model.config!,
          id: model.id,
          brand: model.brand,
          context_window:
            model.defaultContextWindow || model.config!.context_window,
          isRecommended: model.isRecommended,
          tag: model.tag,
          displayName: model.name,
        };
      }),
  };
}

type ListEmbeddingBackendsResponseType = ServerInferResponses<
  typeof contracts.models.listEmbeddingModels
>;

async function listEmbeddingModels(): Promise<ListEmbeddingBackendsResponseType> {
  const embeddingBackends = await router.admin.models.getAdminEmbeddingModels({
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

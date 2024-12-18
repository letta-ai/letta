import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { sdkContracts } from '$letta/sdk/contracts';
import { router } from '$letta/web-api/router';

type ListLLMBackendsResponseType = ServerInferResponses<
  typeof sdkContracts.models.listLLMBackends
>;

type ListLLMBackendsRequestType = ServerInferRequest<
  typeof sdkContracts.models.listLLMBackends
>;

async function listLLMBackends(
  req: ListLLMBackendsRequestType
): Promise<ListLLMBackendsResponseType> {
  const { extended } = req.query;
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
          ...(extended
            ? {
                brand: model.brand,
                isRecommended: model.isRecommended,
                tag: model.tag,
                displayName: model.name,
              }
            : {}),
        };
      }),
  };
}

type ListEmbeddingBackendsResponseType = ServerInferResponses<
  typeof sdkContracts.models.listEmbeddingBackends
>;

type ListEmbeddingBackendsRequestType = ServerInferRequest<
  typeof sdkContracts.models.listEmbeddingBackends
>;

async function listEmbeddingBackends(
  req: ListEmbeddingBackendsRequestType
): Promise<ListEmbeddingBackendsResponseType> {
  const { extended } = req.query;

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
          ...(extended ? { brand: model.brand } : {}),
        };
      }),
  };
}

export const modelsRouter = {
  listLLMBackends,
  listEmbeddingBackends,
};

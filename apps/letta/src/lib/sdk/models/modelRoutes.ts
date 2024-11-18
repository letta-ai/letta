import { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import { sdkContracts } from '$letta/sdk/contracts';
import { router } from '$letta/web-api/router';
import { z } from 'zod';
import { LLMConfigSchema } from '@letta-web/letta-agents-api';


type ListLLMBackendsResponseType = ServerInferResponses<
  typeof sdkContracts.models.listLLMBackends
>;

async function listLLMBackends(): Promise<ListLLMBackendsResponseType> {
  const llmBackends = await router.admin.models.getAdminInferenceModels({
    query: {
      limit: 250,
    }
  })

  if (llmBackends.status !== 200) {
    return {
      status: 500,
      body: {
        error: 'Failed to get LLM backends'
      }
    }
  }


  return {
    status: 200,
    body: llmBackends.body.inferenceModels
      .filter((model) => !!model.config)
      .map((model) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return model.config!
    })
  }
}

type ListEmbeddingBackendsResponseType = ServerInferResponses<
  typeof sdkContracts.models.listEmbeddingBackends
>;

async function listEmbeddingBackends(): Promise<ListEmbeddingBackendsResponseType> {
  const embeddingBackends = await router.admin.models.getAdminEmbeddingModels({
    query: {
      limit: 250,
    }
  });

  if (embeddingBackends.status !== 200) {
    return {
      status: 500,
      body: {
        error: 'Failed to get embedding backends'
      }
    }
  }

  return {
    status: 200,
    body: embeddingBackends.body.embeddingModels
      .filter((model) => !!model.config)
      .map((model) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return model.config!
      })
  }
}

export const modelsRouter = {
  listLLMBackends,
  listEmbeddingBackends,
}

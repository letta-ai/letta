import type { EmbeddingConfig, LLMConfig } from '@letta-web/letta-agents-api';
import { ModelsService } from '@letta-web/letta-agents-api';

let inferenceModelsList: LLMConfig[] = [];

export async function getLettaAgentsInferenceModelsSingleton() {
  if (inferenceModelsList.length === 0) {
    inferenceModelsList = await ModelsService.listModels();
  }

  return inferenceModelsList;
};

let embeddingModelsList: EmbeddingConfig[] = [];

export async function getLettaAgentsEmbeddingModelsSingleton() {
  if (inferenceModelsList.length === 0) {
    embeddingModelsList = await ModelsService.listEmbeddingModels();
  }

  return embeddingModelsList;
}

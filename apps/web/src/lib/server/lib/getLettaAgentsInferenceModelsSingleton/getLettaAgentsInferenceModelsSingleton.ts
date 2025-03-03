import type { EmbeddingConfig, LLMConfig } from '@letta-cloud/sdk-core';
import { ModelsService } from '@letta-cloud/sdk-core';

let inferenceModelsList: LLMConfig[] = [];

interface CommonProps {
  cacheBust?: boolean;
}

export async function getLettaAgentsInferenceModelsSingleton(
  props: CommonProps = {},
) {
  if (inferenceModelsList.length === 0 || props.cacheBust) {
    inferenceModelsList = await ModelsService.listModels();
  }

  return inferenceModelsList;
}

let embeddingModelsList: EmbeddingConfig[] = [];

export async function getLettaAgentsEmbeddingModelsSingleton(
  props: CommonProps = {},
) {
  if (inferenceModelsList.length === 0 || props.cacheBust) {
    embeddingModelsList = await ModelsService.listEmbeddingModels();
  }

  return embeddingModelsList;
}

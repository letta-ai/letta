import type { EmbeddingConfig, LLMConfig } from '@letta-web/letta-agents-api';
import { ModelsService } from '@letta-web/letta-agents-api';

let inferenceModelsList: LLMConfig[] = [];

interface CommonProps {
  cacheBust?: boolean;
}

export async function getLettaAgentsInferenceModelsSingleton(
  props: CommonProps = {}
) {
  if (inferenceModelsList.length === 0 || props.cacheBust) {
    inferenceModelsList = await ModelsService.listModels();
  }

  return inferenceModelsList;
}

let embeddingModelsList: EmbeddingConfig[] = [];

export async function getLettaAgentsEmbeddingModelsSingleton(
  props: CommonProps = {}
) {
  if (inferenceModelsList.length === 0 || props.cacheBust) {
    embeddingModelsList = await ModelsService.listEmbeddingModels();
  }

  return embeddingModelsList;
}

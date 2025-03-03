import { getRedisData } from '@letta-cloud/service-redis';

interface GetCreditCostPerModelOptions {
  modelName: string;
  modelEndpoint: string;
  contextWindowSize: number;
}

export async function getCreditCostPerModel(
  options: GetCreditCostPerModelOptions,
): Promise<number | null> {
  const { modelName, modelEndpoint } = options;

  const data = await getRedisData('modelNameAndEndpointToIdMap', {
    modelName,
    modelEndpoint,
  });

  if (!data) {
    return null;
  }

  const stepCostDefinition = await getRedisData('stepCostSchema', {
    modelId: data.modelId,
  });

  if (!stepCostDefinition) {
    return null;
  }

  const costTier =
    stepCostDefinition.data.find(
      (v) => v.maxContextWindowSize >= options.contextWindowSize,
    ) || stepCostDefinition.data[stepCostDefinition.data.length - 1];

  return costTier.cost;
}

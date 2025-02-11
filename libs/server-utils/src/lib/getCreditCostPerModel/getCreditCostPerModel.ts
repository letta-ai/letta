import { getRedisData } from '@letta-cloud/redis';

interface GetCreditCostPerModelOptions {
  modelName: string;
  modelEndpoint: string;
  contextWindowSize: number;
}

export async function getCreditCostPerModel(
  options: GetCreditCostPerModelOptions,
): Promise<number> {
  const { modelName, modelEndpoint } = options;

  const data = await getRedisData('modelNameAndEndpointToIdMap', {
    modelName,
    modelEndpoint,
  });

  if (!data) {
    return 0;
  }

  const stepCostDefinition = await getRedisData('stepCostSchema', {
    modelId: data.modelId,
  });

  if (!stepCostDefinition) {
    return 0;
  }

  const costTier =
    stepCostDefinition.data.find(
      (v) => v.maxContextWindowSize >= options.contextWindowSize,
    ) || stepCostDefinition.data[stepCostDefinition.data.length - 1];

  return costTier.cost;
}

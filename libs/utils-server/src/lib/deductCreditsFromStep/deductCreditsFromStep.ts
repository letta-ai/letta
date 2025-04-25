import type { Step } from '@letta-cloud/sdk-core';
import { getCreditCostPerModel } from '../getCreditCostPerModel/getCreditCostPerModel';
import { removeCreditsFromOrganization } from '../removeCreditsFromOrganization/removeCreditsFromOrganization';
import {
  createUniqueRedisProperty,
  getRedisData,
} from '@letta-cloud/service-redis';

export async function deductCreditsFromStep(step: Step) {
  if (
    !step.model ||
    !step.model_endpoint ||
    !step.context_window_limit ||
    !step.organization_id
  ) {
    return;
  }

  const [creditCost, modelData] = await Promise.all([
    getCreditCostPerModel({
      modelName: step.model,
      modelEndpoint: step.model_endpoint,
      contextWindowSize: step.context_window_limit,
    }),
    getRedisData('modelNameAndEndpointToIdMap', {
      modelName: step.model,
      modelEndpoint: step.model_endpoint,
    }),
  ]);

  try {
    if (typeof creditCost !== 'number') {
      console.warn(
        `Model ${step.model} [${step.model_endpoint}] has a cost of 0 credits`,
      );
      return;
    }

    const transactionLock = await createUniqueRedisProperty(
      'transactionLock',
      {},
      step.id,
      {
        // expires in 15 minutes
        expiresAt: Date.now() + 15 * 60 * 1000,
        data: {
          lockedAt: Date.now(),
        },
      },
    );

    if (!transactionLock) {
      console.warn(`Transaction lock already exists for step ${step.id}`);
      return;
    }

    const modelTier = modelData?.modelId
      ? await getRedisData('modelIdToModelTier', {
          modelId: modelData.modelId,
        })
      : undefined;

    const response = await removeCreditsFromOrganization({
      amount: creditCost,
      coreOrganizationId: step.organization_id,
      source: 'inference',
      stepId: step.id,
      modelTier: modelTier?.tier,
      modelId: modelData?.modelId,
      note: `Deducted ${creditCost} credits for model ${step.model}`,
    });

    return response;
  } catch (e) {
    console.error(
      `Failed to deduct credits from organization ${step.organization_id} for model ${step.model}`,
    );
    console.error(e);
  }
}

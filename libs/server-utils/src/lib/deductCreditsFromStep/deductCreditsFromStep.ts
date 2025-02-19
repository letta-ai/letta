import type { Step } from '@letta-cloud/letta-agents-api';
import { getCreditCostPerModel } from '../getCreditCostPerModel/getCreditCostPerModel';
import { removeCreditsFromOrganization } from '../removeCreditsFromOrganization/removeCreditsFromOrganization';

export async function deductCreditsFromStep(step: Step) {
  if (
    !step.model ||
    !step.model_endpoint ||
    !step.context_window_limit ||
    !step.organization_id
  ) {
    return;
  }

  const creditCost = await getCreditCostPerModel({
    modelName: step.model,
    modelEndpoint: step.model_endpoint,
    contextWindowSize: step.context_window_limit,
  });

  try {
    if (!creditCost) {
      console.warn(
        `Model ${step.model} [${step.model_endpoint}] has a cost of 0 credits`,
      );
      return;
    }

    const response = await removeCreditsFromOrganization({
      amount: creditCost,
      coreOrganizationId: step.organization_id,
      source: 'inference',
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

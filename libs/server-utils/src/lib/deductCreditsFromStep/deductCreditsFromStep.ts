import type { Step } from '@letta-cloud/letta-agents-api';
import { getCreditCostPerModel } from '../getCreditCostPerModel/getCreditCostPerModel';
import { removeCreditsFromOrganization } from '../removeCreditsFromOrganization/removeCreditsFromOrganization';

export async function deductCreditsFromStep(step: Step) {
  if (!step.model || !step.organization_id) {
    return;
  }

  const creditCost = await getCreditCostPerModel(step.model);

  try {
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

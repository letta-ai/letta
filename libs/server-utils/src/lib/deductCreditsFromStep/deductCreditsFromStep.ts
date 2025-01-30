import type { Step } from '@letta-cloud/letta-agents-api';
import { getCreditCostPerModel } from '../getCreditCostPerModel/getCreditCostPerModel';
import { removeCreditsFromOrganization } from '../removeCreditsFromOrganization/removeCreditsFromOrganization';

export async function deductCreditsFromStep(step: Step) {
  if (!step.model || !step.organization_id) {
    return;
  }

  const creditCost = await getCreditCostPerModel(step.model);

  try {
    await removeCreditsFromOrganization({
      amount: creditCost,
      coreOrganizationId: step.organization_id,
      source: 'inference',
      note: `Deducted ${creditCost} credits for model ${step.model}`,
    });
  } catch (e) {
    console.error(
      `Failed to deduct credits from organization ${step.organization_id} for model ${step.model}`,
    );
    console.error(e);
  }
}

import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';

export async function getCurrentOrganizationUsageLimits(
  organizationId: string,
) {
  const billingTier = await getCustomerSubscription(organizationId);

  return getUsageLimits(billingTier.tier);
}

import { getCustomerBillingTier } from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';

export async function getCurrentOrganizationUsageLimits(
  organizationId: string,
) {
  const billingTier = await getCustomerBillingTier(organizationId);

  return getUsageLimits(billingTier);
}

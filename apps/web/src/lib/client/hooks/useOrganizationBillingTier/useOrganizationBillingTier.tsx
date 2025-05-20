import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

export function useOrganizationBillingTier() {
  const { data } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
    });

  return data?.body.billingTier;
}

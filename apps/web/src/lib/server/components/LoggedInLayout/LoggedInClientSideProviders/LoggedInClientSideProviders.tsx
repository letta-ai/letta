'use client';

import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

interface LoggedInClientSideProvidersProps {
  children: React.ReactNode;
}

export function LoggedInClientSideProviders({
  children,
}: LoggedInClientSideProvidersProps) {
  webApi.organizations.getOrganizationQuotas.useQuery({
    queryKey: webApiQueryKeys.organizations.getOrganizationQuotas,
  });

  webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
  });

  return <>{children}</>;
}

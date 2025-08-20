'use client';

import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { AppContextProvider } from '@letta-cloud/ui-ade-components';
import { useCurrentUser } from '$web/client/hooks';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';

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

  const { id: projectId, slug: projectSlug } = useCurrentProject();
  const user = useCurrentUser();
  return (
    <AppContextProvider
      projectSlug={projectSlug}
      user={user}
      projectId={projectId}
    >
      {children}
    </AppContextProvider>
  );
}

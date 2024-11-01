import React from 'react';
import { ClientSideOrganizationLayout } from './_components/ClientSideOrganizationLayout/ClientSideOrganizationLayout';
import {
  getOrganizationFromOrganizationId,
  getUserOrRedirect,
} from '$letta/server/auth';
import { redirect } from 'next/navigation';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { webApiQueryKeys } from '$letta/client';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

async function OrganizationLayout(props: SettingsLayoutProps) {
  const { children } = props;

  const user = await getUserOrRedirect();

  if (!user) {
    return null;
  }

  const organization = await getOrganizationFromOrganizationId(
    user.organizationId
  );

  if (!organization) {
    redirect('/signout');

    return null;
  }

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
    queryFn: () => ({
      body: organization,
    }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClientSideOrganizationLayout>{children}</ClientSideOrganizationLayout>
    </HydrationBoundary>
  );
}

export default OrganizationLayout;

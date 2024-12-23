'use server';
import React from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { router } from '$web/web-api/router';
import { webApiQueryKeys } from '$web/client';
import { redirect } from 'next/navigation';

interface OrganizationLayoutProps {
  children: React.ReactNode;
  params: {
    organizationId: string;
  };
}

async function OrganizationLayout(props: OrganizationLayoutProps) {
  const {
    children,
    params: { organizationId },
  } = props;
  const queryClient = new QueryClient();

  const organization = await router.admin.organizations.getOrganization({
    params: {
      organizationId,
    },
  });

  if (!organization) {
    redirect('/admin/organizations');
    return null;
  }

  await queryClient.prefetchQuery({
    queryKey:
      webApiQueryKeys.admin.organizations.getOrganization(organizationId),
    queryFn: () => ({
      body: organization.body,
    }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}

export default OrganizationLayout;

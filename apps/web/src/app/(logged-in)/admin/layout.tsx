'use server';
import type { ReactNode } from 'react';
import React from 'react';
import {
  getOrganizationFromOrganizationId,
  getUserOrRedirect,
} from '$web/server/auth';
import { redirect } from 'next/navigation';
import { QueryClient } from '@tanstack/react-query';
import { queryClientKeys } from '$web/web-api/contracts';
import { Frame, HStack, Logo, VStack } from '@letta-web/component-library';
import Link from 'next/link';
import { AdminNavigation } from './_components/AdminNavigation/AdminNavigation';
import { DashboardTransition } from '$web/client/components/DashboardLikeLayout/DashboardTransition/DashboardTransition';

interface InAppProps {
  children: ReactNode;
}

function AdminDashboardNavigation() {
  return (
    <>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <HStack className="h-header min-h-header" fullWidth></HStack>
      <HStack
        as="header"
        padding="xxsmall"
        position="fixed"
        zIndex="header"
        fullWidth
        /* eslint-disable-next-line react/forbid-component-props */
        className="top-0"
      >
        <HStack
          border
          color="background"
          fullWidth
          justify="spaceBetween"
          align="center"
          paddingX="large"
          /* eslint-disable-next-line react/forbid-component-props */
          className="h-header min-h-header"
        >
          <Link href="/">
            <HStack fullWidth align="center">
              <Logo />
              Letta Admin
            </HStack>
          </Link>
        </HStack>
      </HStack>
    </>
  );
}

export default async function LoggedInLayout(props: InAppProps) {
  const { children } = props;
  const queryClient = new QueryClient();
  const user = await getUserOrRedirect();

  if (!user) {
    redirect('/');

    return null;
  }

  const organization = await getOrganizationFromOrganizationId(
    user.activeOrganizationId
  );

  if (!organization?.isAdmin) {
    redirect('/');

    return null;
  }

  await queryClient.prefetchQuery({
    queryKey: queryClientKeys.organizations.getCurrentOrganization,
    queryFn: () => ({
      body: organization,
    }),
  });

  return (
    <VStack gap="small" fullHeight fullWidth>
      <AdminDashboardNavigation />
      <HStack gap={false} fullWidth>
        <AdminNavigation />
        <Frame position="relative" overflow="hidden" fullWidth>
          <DashboardTransition>{children}</DashboardTransition>
        </Frame>
      </HStack>
    </VStack>
  );
}

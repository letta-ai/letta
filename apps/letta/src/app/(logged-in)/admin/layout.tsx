'use server';
import type { ReactNode } from 'react';
import React from 'react';
import {
  getOrganizationFromOrganizationId,
  getUserOrRedirect,
} from '$letta/server/auth';
import { redirect } from 'next/navigation';
import { QueryClient } from '@tanstack/react-query';
import { queryClientKeys } from '$letta/web-api/contracts';
import { Frame, HStack, Logo, VStack } from '@letta-web/component-library';
import Link from 'next/link';
import { AdminNavigation } from './_components/AdminNavigation/AdminNavigation';
const SIDEBAR_WIDTH = 'w-[250px] min-w-[250px]';

interface InAppProps {
  children: ReactNode;
}

function Sidebar() {
  return (
    <VStack
      align="center"
      gap={false}
      fullHeight
      borderRight
      /* eslint-disable-next-line react/forbid-component-props */
      className={SIDEBAR_WIDTH}
    >
      <HStack
        align="center"
        paddingX="large"
        fullWidth
        borderBottom
        color="background-black"
        justify="spaceBetween"
        /* eslint-disable-next-line react/forbid-component-props */
        className="min-h-header h-header"
      >
        <Link href="/">
          <HStack fullWidth align="center">
            <Logo /> Letta Admin
          </HStack>
        </Link>
      </HStack>
      <VStack gap={false} as="nav" fullWidth fullHeight>
        <AdminNavigation />
      </VStack>
    </VStack>
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
    <div className="pageFadeIn w-[100vw] h-[100vh]">
      <HStack gap={false} fullHeight fullWidth>
        <Sidebar />
        <Frame overflow="auto" fullHeight fullWidth>
          {children}
        </Frame>
      </HStack>
    </div>
  );
}

'use server';
import type { ReactNode } from 'react';
import { LoggedInLayout } from '$web/server/components';
import { headers } from 'next/headers';
import { CURRENT_PATH_HEADER } from '$web/constants';

interface InAppProps {
  children: ReactNode;
}

export default async function Layout({ children }: InAppProps) {
  const headerList = await headers();

  return (
    <LoggedInLayout
      shouldRedirectTo={(user) => {
        if (!user) {
          return `/login?redirect=${headerList.get(CURRENT_PATH_HEADER)}`;
        }

        if (!user?.activeOrganizationId) {
          return '/select-organization';
        }

        return '';
      }}
    >
      {children}
    </LoggedInLayout>
  );
}

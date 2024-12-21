'use server';
import type { ReactNode } from 'react';
import { LoggedInLayout } from '$web/server/components';

interface InAppProps {
  children: ReactNode;
}

export default async function Layout({ children }: InAppProps) {
  return (
    <LoggedInLayout
      shouldRedirectTo={(user) => {
        if (!user) {
          return '/login';
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

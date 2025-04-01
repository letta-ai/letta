import type { ReactNode } from 'react';
import React from 'react';
import { getUser } from '$web/server/auth';
import { NoCloudAccessAPIPage } from './components/NoCloudAccessAPIPage/NoCloudAccessAPIPage';

interface APIKeysLayoutProps {
  children: ReactNode;
}

export default async function APIKeysLayout(props: APIKeysLayoutProps) {
  const { children } = props;

  const user = await getUser();

  if (!user?.hasCloudAccess) {
    return <NoCloudAccessAPIPage />;
  }

  return <>{children}</>;
}

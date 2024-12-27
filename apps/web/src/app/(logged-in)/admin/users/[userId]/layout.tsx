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

interface UserLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    userId: string;
  }>;
}

async function UserLayout(props: UserLayoutProps) {
  const { children, params } = props;

  const { userId } = await params;
  const queryClient = new QueryClient();

  const user = await router.admin.users.adminGetUser({
    params: {
      userId,
    },
  });

  if (user.status !== 200 || !user.body) {
    redirect('/admin/users');
    return null;
  }

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.admin.users.adminGetUser(userId),
    queryFn: () => ({
      body: user.body,
    }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}

export default UserLayout;

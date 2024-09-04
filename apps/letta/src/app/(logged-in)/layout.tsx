'use server';
import type { ReactNode } from 'react';
import { getUser } from '$letta/server/auth';
import { redirect } from 'next/navigation';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { userQueryClientKeys } from '$letta/any/contracts/user';
import { LettaAgentsAPIWrapper } from '@letta-web/letta-agents-api';

interface InAppProps {
  children: ReactNode;
}

export default async function LoggedInLayout(props: InAppProps) {
  const { children } = props;
  const user = await getUser();

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: userQueryClientKeys.getCurrentUser,
    queryFn: () => ({
      body: user,
    }),
  });

  if (!user) {
    redirect('/login');

    return null;
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LettaAgentsAPIWrapper>{children}</LettaAgentsAPIWrapper>
    </HydrationBoundary>
  );
}

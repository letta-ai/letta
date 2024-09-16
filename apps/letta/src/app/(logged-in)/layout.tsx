'use server';
import type { ReactNode } from 'react';
import { getUser } from '$letta/server/auth';
import { redirect } from 'next/navigation';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { userQueryClientKeys } from '$letta/web-api/contracts/user';
import { LettaAgentsAPIWrapper } from '@letta-web/letta-agents-api';
import { GlobalSessionSettingsProvider } from '$letta/client/hooks/session';
import { getUserFlags } from '@letta-web/feature-flags';
import { queryClientKeys } from '$letta/web-api/contracts';

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

  const featureFlags = await Promise.race([
    getUserFlags({
      userId: user?.id,
    }),
    new Promise((resolve) => setTimeout(resolve, 150)),
  ]);

  if (featureFlags) {
    await queryClient.prefetchQuery({
      queryKey: queryClientKeys.featureFlags.getFeatureFlags,
      queryFn: () => ({
        body: featureFlags,
      }),
    });
  }

  return (
    <GlobalSessionSettingsProvider>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <LettaAgentsAPIWrapper>{children}</LettaAgentsAPIWrapper>
      </HydrationBoundary>
    </GlobalSessionSettingsProvider>
  );
}

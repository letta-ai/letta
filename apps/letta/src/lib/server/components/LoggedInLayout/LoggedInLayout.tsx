'use server';
import type { ReactNode } from 'react';
import type { GetUserDataResponse } from '$letta/server/auth';
import { getUser } from '$letta/server/auth';
import { redirect } from 'next/navigation';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { GlobalSessionSettingsProvider } from '$letta/client/hooks/session';
import { getUserFlags } from '@letta-web/feature-flags';
import { queryClientKeys } from '$letta/web-api/contracts';
import { IdentifyUserForMixpanel } from '@letta-web/analytics/client';
import { webApiQueryKeys } from '$letta/client';
import { LoggedInClientSideProviders } from './LoggedInClientSideProviders/LoggedInClientSideProviders';
import { WelcomeOverlayWrapper } from './WelcomeOverlayWrapper/WelcomeOverlayWrapper';

interface InAppProps {
  children: ReactNode;
  shouldRedirectTo: (user: GetUserDataResponse | null) => string;
}

export async function LoggedInLayout(props: InAppProps) {
  const { children } = props;

  const user = await getUser();

  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.user.getCurrentUser,
    queryFn: () => ({
      body: user,
    }),
  });

  const redirectTo = props.shouldRedirectTo(user);

  if (redirectTo) {
    redirect(redirectTo);
  }

  if (!user) {
    return null;
  }

  const featureFlags = await Promise.race([
    getUserFlags(user),
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
      <IdentifyUserForMixpanel userId={user.id} />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <LoggedInClientSideProviders>
          <WelcomeOverlayWrapper>{children}</WelcomeOverlayWrapper>
        </LoggedInClientSideProviders>
      </HydrationBoundary>
    </GlobalSessionSettingsProvider>
  );
}

'use server';
import type { ReactNode } from 'react';
import type { GetUserDataResponse } from '$web/server/auth';
import { getUser, getOrganizationFromOrganizationId } from '$web/server/auth';
import { redirect } from 'next/navigation';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { GlobalSessionSettingsProvider } from '$web/client/hooks/session';
import { queryClientKeys } from '$web/web-api/contracts';
import { IdentifyUserForPostHog } from '@letta-cloud/service-analytics/client';
import { webApiQueryKeys } from '$web/client';
import { LoggedInClientSideProviders } from './LoggedInClientSideProviders/LoggedInClientSideProviders';
import { WelcomeOverlayWrapper } from './WelcomeOverlayWrapper/WelcomeOverlayWrapper';
import { router } from '$web/web-api/router';
import { OnboardingProvider } from '$web/client/hooks/useOnboarding';
import { VerifyAccountLoginWrapper } from '$web/server/components/LoggedInLayout/VerifyAccountLoginWrapper/VerifyAccountLoginWrapper';
import { IdentifyUserForMixpanel } from '@letta-cloud/service-analytics/client';

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

  // Prefetch organization data to prevent layout shift in ProfilePopover
  if (user?.activeOrganizationId) {
    const organization = await getOrganizationFromOrganizationId(
      user.activeOrganizationId,
    );

    if (organization) {
      await queryClient.prefetchQuery({
        queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
        queryFn: () => ({
          body: organization,
        }),
      });
    }
  }

  const redirectTo = props.shouldRedirectTo(user);

  if (redirectTo) {
    redirect(redirectTo);
  }

  if (!user) {
    return null;
  }

  const featureFlags = await Promise.race([
    router.featureFlags.getFeatureFlags(),
    new Promise((resolve) => setTimeout(resolve, 150)),
  ]);

  if (featureFlags) {
    await queryClient.prefetchQuery({
      queryKey: queryClientKeys.featureFlags.getFeatureFlags,
      queryFn: () => featureFlags,
    });
  }

  return (
    <GlobalSessionSettingsProvider>
      <IdentifyUserForMixpanel userId={user.id} />
      <IdentifyUserForPostHog
        userId={user.id}
        name={user.name}
        email={user.email}
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <LoggedInClientSideProviders>
          <VerifyAccountLoginWrapper>
            <WelcomeOverlayWrapper>
              <OnboardingProvider>{children}</OnboardingProvider>
            </WelcomeOverlayWrapper>
          </VerifyAccountLoginWrapper>
        </LoggedInClientSideProviders>
      </HydrationBoundary>
    </GlobalSessionSettingsProvider>
  );
}

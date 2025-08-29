'use client';
import React, { type PropsWithChildren, useEffect } from 'react';
import { environment } from '@letta-cloud/config-environment-variables';
import type { AnalyticsEvent } from '../events';
import type { AnalyticsEventProperties } from '../events';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { usePostHog } from 'posthog-js/react';
import { ErrorBoundary } from 'react-error-boundary';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';

declare global {
  interface Window {
    identity?: {
      userId: string;
    };
  }
}

function getPlatformType() {
  if (CURRENT_RUNTIME === 'letta-desktop') {
    return 'letta-desktop';
  }

  if (typeof window === 'undefined') {
    return 'unknown';
  }

  if (window.location.href.includes('/development-servers')) {
    return 'self-hosted';
  }

  return 'cloud';
}

type ProvidersProps = PropsWithChildren<Record<never, string>>;

export function PHProvider({ children }: ProvidersProps) {
  // Fallback environment vars are for letta-desktop
  const posthogKey =
    environment.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost =
    environment.NEXT_PUBLIC_POSTHOG_HOST ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST;

  useEffect(() => {
    if (!posthogKey || !posthogHost) {
      return;
    }
    posthog.init(posthogKey, {
      api_host: posthogHost,
    });
    posthog.register({
      platform_type: getPlatformType(),
    });
  }, [posthogKey, posthogHost]);

  if (!posthogKey || !posthogHost) {
    return children;
  }

  return (
    <ErrorBoundary fallback={children}>
      <PostHogProvider client={posthog}>{children}</PostHogProvider>
    </ErrorBoundary>
  );
}

interface IdentifyUserProps {
  userId: string;
  name?: string;
  email?: string;
}

// NOTE: This is not supported on letta-desktop
export function IdentifyUserForPostHog(props: IdentifyUserProps) {
  const { userId, name, email } = props;
  const posthogClient = usePostHog();

  useEffect(() => {
    try {
      if (
        !environment.NEXT_PUBLIC_POSTHOG_KEY ||
        !environment.NEXT_PUBLIC_POSTHOG_HOST
      ) {
        return;
      }

      window.identity = { userId };

      posthogClient.identify(userId, { name: name, email: email }); // posthog distinct id is the user id
    } catch (error) {
      console.error('Error identifying user on PostHog', error);
    }
  }, [userId, email, name, posthogClient]);

  return null;
}

export function trackClientSideEvent<Event extends AnalyticsEvent>(
  eventName: Event,
  properties: AnalyticsEventProperties[Event],
) {
  try {
    posthog.capture(eventName, {
      platform_type: getPlatformType(),
      ...properties,
    });
  } catch (error) {
    console.error('Error tracking PostHog event', error);
  }
}

'use client';
import React, { type PropsWithChildren, useEffect } from 'react';
import { environment } from '@letta-cloud/config-environment-variables';
import type { AnalyticsEvent } from '../events';
import type { AnalyticsEventProperties } from '../events';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
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
  if (CURRENT_RUNTIME === 'letta-docker-enterprise') {
    return 'letta-docker-enterprise';
  }

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
      capture_pageview: true,
      capture_pageleave: true,
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
  organization?: string | null;
}

// NOTE: This is not supported on letta-desktop
export function IdentifyUserForPostHog(props: IdentifyUserProps) {
  const { userId, name, email, organization } = props;

  const posthogKey =
    environment.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost =
    environment.NEXT_PUBLIC_POSTHOG_HOST ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST;

  useEffect(() => {
    try {
      if (!posthogKey || !posthogHost) {
        return;
      }
      posthog.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: true,
        capture_pageleave: true,
        loaded: (posthog) => {
          window.identity = { userId };
          // posthog distinct id is the user id
          posthog.identify(userId, {
            name: name,
            email: email,
            organization: organization,
          });
        },
      });
    } catch (error) {
      console.error('Error identifying user on PostHog', error);
    }
  }, [userId, email, name, organization, posthogKey, posthogHost]);

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

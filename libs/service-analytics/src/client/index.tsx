'use client';
import React, { type PropsWithChildren, useEffect, useRef } from 'react';
import { environment } from '@letta-cloud/config-environment-variables';
import type { AnalyticsEvent } from '../events';
import type { AnalyticsEventProperties } from '../events';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { usePostHog } from 'posthog-js/react';
import { ErrorBoundary } from 'react-error-boundary';
import mixpanel from 'mixpanel-browser';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';

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

function LoadMixpanelAnalyticsInner() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) {
      return;
    }

    if (!environment.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      return;
    }

    mounted.current = true;
    mixpanel.init(environment.NEXT_PUBLIC_MIXPANEL_TOKEN, {
      api_host: 'https://robots.letta.com',
    });
  }, []);

  return null;
}

function LogErrorLoadingMixpanelAnalytics() {
  useEffect(() => {
    console.error(
      'Mixpanel token not found. Please set the MIXPANEL_TOKEN environment variable.',
    );
  }, []);

  return null;
}

export function IdentifyUserForMixpanel(props: IdentifyUserProps) {
  const { userId } = props;

  useEffect(() => {
    try {
      if (!environment.NEXT_PUBLIC_MIXPANEL_TOKEN) {
        return;
      }

      mixpanel.identify(userId);
    } catch (error) {
      console.error('Error identifying user on Mixpanel', error);
    }
  }, [userId]);
  return null;
}

export function LoadMixpanelAnalytics() {
  return (
    <ErrorBoundary fallback={<LogErrorLoadingMixpanelAnalytics />}>
      <LoadMixpanelAnalyticsInner />
    </ErrorBoundary>
  );
}

type ProvidersProps = PropsWithChildren<Record<never, string>>;

export function PHProvider({ children }: ProvidersProps) {
  useEffect(() => {
    if (
      !environment.NEXT_PUBLIC_POSTHOG_KEY ||
      !environment.NEXT_PUBLIC_POSTHOG_HOST
    ) {
      return;
    }
    posthog.init(environment.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: environment.NEXT_PUBLIC_POSTHOG_HOST,
    });
  }, []);

  if (
    !environment.NEXT_PUBLIC_POSTHOG_KEY ||
    !environment.NEXT_PUBLIC_POSTHOG_HOST
  ) {
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

      posthogClient.identify(userId, { name: name, email: email });
    } catch (error) {
      console.error('Error identifying user on PostHog', error);
    }
  }, [userId, email, name]);

  return null;
}

export function trackClientSideEvent<Event extends AnalyticsEvent>(
  eventName: Event,
  properties: AnalyticsEventProperties[Event],
) {
  try {
    posthog.capture(eventName, {
      distinct_id: 'userId' in properties ? properties.userId : '',
      platformType: getPlatformType(),
      ...properties,
    });
  } catch (error) {
    console.error('Error tracking PostHog event', error);
  }

  try {
    mixpanel.track(eventName, properties);
  } catch (error) {
    console.error('Error tracking Mixpanel event', error);
  }
}

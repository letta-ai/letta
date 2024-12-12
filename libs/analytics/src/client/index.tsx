'use client';
import React, { useEffect, useRef } from 'react';
import { environment } from '@letta-web/environmental-variables';
import mixpanel from 'mixpanel-browser';
import type { AnalyticsEvent } from '../events';
import type { AnalyticsEventProperties } from '../events';
import { ErrorBoundary } from 'react-error-boundary';

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
      'Mixpanel token not found. Please set the MIXPANEL_TOKEN environment variable.'
    );
  }, []);

  return null;
}

export function LoadMixpanelAnalytics() {
  return (
    <ErrorBoundary fallback={<LogErrorLoadingMixpanelAnalytics />}>
      <LoadMixpanelAnalyticsInner />
    </ErrorBoundary>
  );
}

interface IdentifyUserProps {
  userId: string;
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
      console.error('Error identifying user', error);
    }
  }, [userId]);

  return null;
}

export function trackClientSideEvent<Event extends AnalyticsEvent>(
  eventName: Event,
  properties: AnalyticsEventProperties[Event]
) {
  try {
    if (!environment.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      return;
    }

    mixpanel.track(eventName, properties);
  } catch (error) {
    console.error('Error tracking event', error);
  }
}

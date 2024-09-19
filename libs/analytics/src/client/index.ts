'use client';
import { useEffect, useRef } from 'react';
import { environment } from '@letta-web/environmental-variables';
import mixpanel from 'mixpanel-browser';
import type { AnalyticsEvent } from '../events';
import type { AnalyticsEventProperties } from '../events';

export function LoadMixpanelAnalytics() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) {
      return;
    }

    mounted.current = true;
    mixpanel.init(environment.NEXT_PUBLIC_MIXPANEL_TOKEN);
  }, []);

  return null;
}

interface IdentifyUserProps {
  userId: string;
}

export function IdentifyUserForMixpanel(props: IdentifyUserProps) {
  const { userId } = props;

  useEffect(() => {
    mixpanel.identify(userId);
  }, [userId]);

  return null;
}

export function trackClientSideEvent<Event extends AnalyticsEvent>(
  eventName: Event,
  properties: AnalyticsEventProperties[Event]
) {
  mixpanel.track(eventName, properties);
}

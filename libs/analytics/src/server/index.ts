/*
 * Right now only trigger events on the server side only!
 */
import * as mixpanel from 'mixpanel';
import { environment } from '@letta-web/environmental-variables';
import type { AnalyticsEvent, AnalyticsEventProperties } from '../events';
import * as Sentry from '@sentry/nextjs';

let mixpanelSingleton: mixpanel.Mixpanel | null = null;

function getMixpanel() {
  if (!environment.NEXT_PUBLIC_MIXPANEL_TOKEN) {
    return null;
  }

  if (!mixpanelSingleton) {
    mixpanelSingleton = mixpanel.init(environment.MIXPANEL_TOKEN);
  }

  return mixpanelSingleton;
}

export interface TrackUserPayload {
  userId: string;
  name: string;
  email: string;
}

export function trackUserOnServer(user: TrackUserPayload) {
  const mixpanel = getMixpanel();

  if (!mixpanel) {
    return;
  }

  mixpanel.people.set(user.userId, {
    $name: user.name,
    $email: user.email,
  });
}

export function trackServerSideEvent<Event extends AnalyticsEvent>(
  eventName: Event,
  properties: AnalyticsEventProperties[Event]
) {
  try {
    const mixpanel = getMixpanel();

    if (!mixpanel) {
      return;
    }

    if (properties) {
      mixpanel.track(eventName, {
        ...('userId' in properties ? { distinct_id: properties.userId } : {}),
        ...properties,
      });
      return;
    }

    mixpanel.track(eventName);
  } catch (error) {
    Sentry.captureException(error);
  }
}

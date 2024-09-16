/*
 * Right now only trigger events on the server side only!
 */
import * as mixpanel from 'mixpanel';
import { environment } from '@letta-web/environmental-variables';
import type { AnalyticsEvent, AnalyticsEventProperties } from './events';

let mixpanelSingleton: mixpanel.Mixpanel | null = null;

function getMixpanel() {
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

export function trackUser(user: TrackUserPayload) {
  getMixpanel().people.set(user.userId, {
    $name: user.name,
    $email: user.email,
  });
}

export function trackEvent<Event extends AnalyticsEvent>(
  eventName: Event,
  properties: AnalyticsEventProperties[Event]
) {
  if (properties) {
    getMixpanel().track(eventName, {
      distinct_id: properties.userId,
      ...properties,
    });
    return;
  }

  getMixpanel().track(eventName);
}

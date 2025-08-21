/*
 * Right now only trigger events on the server side only!
 */
import { environment } from '@letta-cloud/config-environment-variables';
import type { AnalyticsEvent, AnalyticsEventProperties } from '../events';
import { PostHog } from 'posthog-node';

export interface TrackUserPayload {
  userId: string;
  name: string;
  email: string;
}

function PostHogClient() {
  if (!environment.POSTHOG_KEY || !environment.NEXT_PUBLIC_POSTHOG_HOST) {
    return null;
  }

  const posthogClient = new PostHog(environment.POSTHOG_KEY, {
    host: environment.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });

  return posthogClient;
}

export function trackUserOnServer(user: TrackUserPayload) {
  try {
    const posthog = PostHogClient();

    posthog?.identify({
      distinctId: user.userId,
      properties: {
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Failed to identify user on PostHog', error);
  }
}

export async function trackServerSideEvent<Event extends AnalyticsEvent>(
  eventName: Event,
  properties: AnalyticsEventProperties[Event],
) {
  try {
    const posthog = PostHogClient();
    let captured = false;

    if (properties) {
      posthog?.capture({
        distinctId: 'user_id' in properties ? properties.user_id : '',
        event: eventName,
        properties: {
          ...properties,
        },
      });
      captured = true;
    }

    if (!captured) {
      posthog?.capture({ event: eventName, distinctId: '' });
    }
    await posthog?.shutdown();
  } catch (error) {
    console.error('Failed to track event on PostHog', error);
  }
}

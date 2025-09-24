// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - causing some weird typescript error
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

import { config } from 'dotenv';
import { resolve } from 'path';

// config({ path: resolve(__dirname, '../../../.env') });

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - sometimes this code is run on the server
if (typeof window === 'undefined') {
  config({ path: resolve(__dirname, '.env') });
}

export const environment = createEnv({
  server: {
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),
    LETTA_AGENTS_ENDPOINT: z.string().optional(),
    POSTHOG_KEY: z.string().optional(),
    POSTHOG_HOST: z.string().optional(),
    LAUNCH_DARKLY_SDK_KEY: z.string().optional(),
    HUBSPOT_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    AUTH_GITHUB_CLIENT_ID: z.string().optional(),
    AUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
    AUTH_GITHUB_REDIRECT_URI: z.string().optional(),
    TEMPORAL_LETTUCE_API_HOST: z.string().optional(),
    TEMPORAL_LETTUCE_CA_PEM: z.string().optional(),
    TEMPORAL_LETTUCE_CA_KEY: z.string().optional(),
    TEMPORAL_LETTUCE_NAMESPACE: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    CORE_DATABASE_URL: z.string().optional(),
    WORKOS_CLIENT_ID: z.string().optional(),
    CLOUD_API_ENDPOINT: z.string().optional(),
    WORKOS_API_KEY: z.string().optional(),
    TWILIO_SID: z.string().optional(),
    TWILIO_SECRET: z.string().optional(),
    INTERCOM_SECRET: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_CURRENT_HOST: z.string().optional(),
    NEXT_PUBLIC_AGENTFILES_SITE: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISH_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  },
  runtimeEnv: {
    TEMPORAL_LETTUCE_NAMESPACE: process.env.TEMPORAL_LETTUCE_NAMESPACE,
    TEMPORAL_LETTUCE_API_HOST: process.env.TEMPORAL_LETTUCE_API_HOST,
    TEMPORAL_LETTUCE_CA_PEM: process.env.TEMPORAL_LETTUCE_CA_PEM,
    TEMPORAL_LETTUCE_CA_KEY: process.env.TEMPORAL_LETTUCE_CA_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    LETTA_AGENTS_ENDPOINT: process.env.LETTA_AGENTS_ENDPOINT,
    NEXT_PUBLIC_CURRENT_HOST: process.env.NEXT_PUBLIC_CURRENT_HOST,
    POSTHOG_KEY: process.env.POSTHOG_KEY,
    POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    LAUNCH_DARKLY_SDK_KEY: process.env.LAUNCH_DARKLY_SDK_KEY,
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_GITHUB_CLIENT_ID: process.env.AUTH_GITHUB_CLIENT_ID,
    AUTH_GITHUB_CLIENT_SECRET: process.env.AUTH_GITHUB_CLIENT_SECRET,
    AUTH_GITHUB_REDIRECT_URI: process.env.AUTH_GITHUB_REDIRECT_URI,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISH_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISH_KEY,
    WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID,
    WORKOS_API_KEY: process.env.WORKOS_API_KEY,
    TWILIO_SID: process.env.TWILIO_SID,
    TWILIO_SECRET: process.env.TWILIO_SECRET,
    INTERCOM_SECRET: process.env.INTERCOM_SECRET,
    NEXT_PUBLIC_AGENTFILES_SITE: process.env.NEXT_PUBLIC_CURRENT_HOST?.endsWith(
      '3000',
    )
      ? 'http://localhost:3001'
      : 'https://agentfiles.directory',
    CLOUD_API_ENDPOINT:
      process.env.CLOUD_API_ENDPOINT || 'http://localhost:3006',
    CORE_DATABASE_URL: `postgresql://${process.env.LETTA_PG_USER}:${process.env.LETTA_PG_PASSWORD}@${process.env.LETTA_PG_HOST}:${process.env.LETTA_PG_PORT}/${process.env.LETTA_PG_DB}`,
  },
});

// @ts-expect-error - we know that parsedData is valid
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

import { config } from 'dotenv';
import { resolve } from 'path';

// config({ path: resolve(__dirname, '../../../.env') });

// @ts-ignore
if (typeof window === 'undefined') {
  config({ path: resolve(__dirname, '.env') });
}

/* eslint-disable @typescript-eslint/naming-convention */
export const environment = createEnv({
  server: {
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),
    LETTA_AGENTS_ENDPOINT: z.string().optional(),
    MIXPANEL_TOKEN: z.string().optional(),
    LAUNCH_DARKLY_SDK_KEY: z.string().optional(),
    HUBSPOT_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    COMPOSIO_API_KEY: z.string().optional(),
    AUTH_GITHUB_CLIENT_ID: z.string().optional(),
    AUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
    AUTH_GITHUB_REDIRECT_URI: z.string().optional(),
    TEMPORAL_LETTUCE_API_HOST: z.string().optional(),
    TEMPORAL_LETTUCE_CA_PEM: z.string().optional(),
    TEMPORAL_LETTUCE_CA_KEY: z.string().optional(),
    TEMPORAL_LETTUCE_NAMESPACE: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    CORE_DATABASE_URL: z.string().optional(),
    WORKOS_CLIENT_ID: z.string().optional(),
    CLOUD_API_ENDPOINT: z.string().optional(),
    WORKOS_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_CURRENT_HOST: z.string().optional(),
    NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISH_KEY: z.string().optional(),
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
    MIXPANEL_TOKEN: process.env.MIXPANEL_TOKEN,
    NEXT_PUBLIC_MIXPANEL_TOKEN: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
    LAUNCH_DARKLY_SDK_KEY: process.env.LAUNCH_DARKLY_SDK_KEY,
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY,
    AUTH_GITHUB_CLIENT_ID: process.env.AUTH_GITHUB_CLIENT_ID,
    AUTH_GITHUB_CLIENT_SECRET: process.env.AUTH_GITHUB_CLIENT_SECRET,
    AUTH_GITHUB_REDIRECT_URI: process.env.AUTH_GITHUB_REDIRECT_URI,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISH_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISH_KEY,
    WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID,
    WORKOS_API_KEY: process.env.WORKOS_API_KEY,
    CLOUD_API_ENDPOINT:
      process.env.CLOUD_API_ENDPOINT || 'http://localhost:3006',
    CORE_DATABASE_URL: `postgresql://${process.env.LETTA_PG_USER}:${process.env.LETTA_PG_PASSWORD}@${process.env.LETTA_PG_HOST}:${process.env.LETTA_PG_PORT}/${process.env.LETTA_PG_DB}`,
  },
});

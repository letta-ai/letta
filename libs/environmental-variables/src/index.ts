// @ts-expect-error - we know that parsedData is valid
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '.env') });

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
    COMPOSIO_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_CURRENT_HOST: z.string().optional(),
    NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
  },
  runtimeEnv: {
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
    COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY
  },
});

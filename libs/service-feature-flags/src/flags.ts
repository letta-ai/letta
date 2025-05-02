import type { ZodType } from 'zod';
import { z } from 'zod';

interface FlagProperties {
  description: string;
  expiryDate: `${number}-${number}-${number}`;
  flagValue: ZodType;
}

// Flags should be defined here
// Generate the flag values here:
// https://app.launchdarkly.com/projects/default/flags?env=test&selected-env=test
export const featureFlags = {
  ALLOW_MODEL_PROVIDER_CONFIGURATION: {
    description: 'Allow model provider configuration',
    expiryDate: '2024-01-31',
    flagValue: z.boolean(),
  },
  LAUNCH_LINKS: {
    description: 'Launch links',
    expiryDate: '2024-01-31',
    flagValue: z.boolean(),
  },
  IDENTITIES: {
    description: 'Identities',
    expiryDate: '2024-03-01',
    flagValue: z.boolean(),
  },
  ONBOARDING: {
    description: 'Onboarding',
    expiryDate: '2024-02-31',
    flagValue: z.boolean(),
  },
  NEW_DEVELOPMENT_SERVER: {
    description: 'Switch between development servers',
    expiryDate: '2024-04-01',
    flagValue: z.boolean(),
  },
  USE_TEMPORAL_FOR_MIGRATIONS: {
    description: 'Use Temporal for migrations',
    expiryDate: '2024-04-01',
    flagValue: z.boolean(),
  },
  SLEEP_TIME_AGENTS: {
    description: 'Sleep time agents',
    expiryDate: '2024-04-01',
    flagValue: z.boolean(),
  },
  PRO_PLAN: {
    description: 'Pro plan',
    expiryDate: '2024-04-01',
    flagValue: z.boolean(),
  },
  DETAILED_MESSAGE_VIEW: {
    description: 'See detailed message view from the agent chat page',
    expiryDate: '2024-06-01',
    flagValue: z.boolean(),
  },
  MODELS_ROOT_PAGE: {
    description: 'Models root page',
    expiryDate: '2024-06-01',
    flagValue: z.boolean(),
  },
  VOICE_SLEEPTIME_AGENT: {
    description: 'Voice sleep time agent starter kit',
    expiryDate: '2024-07-01',
    flagValue: z.boolean(),
  },
} satisfies Record<string, FlagProperties>;

export type Flag = keyof typeof featureFlags;
export type FlagValue<T extends Flag> = z.infer<
  (typeof featureFlags)[T]['flagValue']
>;
export type FlagMap = Record<Flag, FlagValue<Flag>>;

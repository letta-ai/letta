import type { ZodType } from 'zod';
import { z } from 'zod';

interface FlagProperties {
  description: string;
  expiryDate?: `${number}-${number}-${number}`;
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
  USE_TEMPORAL_FOR_MIGRATIONS: {
    description: 'Use Temporal for migrations',
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
  VOICE_SLEEPTIME_AGENT: {
    description: 'Voice sleep time agent starter kit',
    expiryDate: '2024-07-01',
    flagValue: z.boolean(),
  },
  MIGRATIONS_VIEWER: {
    description: 'Make managing agents more transparent',
    expiryDate: '2024-07-01',
    flagValue: z.boolean(),
  },
  MORE_MEMORY_FIELDS: {
    description: 'More memory fields',
    expiryDate: '2024-07-01',
    flagValue: z.boolean(),
  },
  EXPERIMENTAL_ASYNC_LOOP: {
    description: 'Enable experimental async loop for streaming messages',
    expiryDate: '2025-07-01',
    flagValue: z.boolean(),
  },
  EMAIL_SIGNUP: {
    description: 'Email signup',
    expiryDate: '2024-07-01',
    flagValue: z.boolean(),
  },
  PROJECT_OBSERVABILITY: {
    description: 'Project observability',
    expiryDate: '2024-08-01',
    flagValue: z.boolean(),
  },
  GENERAL_ACCESS: {
    description: 'General access',
    expiryDate: '2025-07-01',
    flagValue: z.boolean(),
  },
  SYSTEM_WARNING: {
    flagValue: z.object({
      title: z.string(),
    }),
    description: 'System warning',
  },
} satisfies Record<string, FlagProperties>;

export type Flag = keyof typeof featureFlags;
export type FlagValue<T extends Flag> = z.infer<
  (typeof featureFlags)[T]['flagValue']
>;
export type FlagMap = Record<Flag, FlagValue<Flag>>;

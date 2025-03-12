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
  BILLING: {
    description: 'Billing',
    expiryDate: '2024-01-31',
    flagValue: z.boolean(),
  },
  IDENTITIES: {
    description: 'Identities',
    expiryDate: '2024-03-01',
    flagValue: z.boolean(),
  },
  TEMPLATE_DISTRIBUTION: {
    description: 'Template distribution',
    flagValue: z.boolean(),
    expiryDate: '2024-03-01',
  },
  CREDIT_RATE_LIMITS: {
    description: 'Credit rate limits',
    expiryDate: '2024-02-31',
    flagValue: z.boolean(),
  },
  ONBOARDING: {
    description: 'Onboarding',
    expiryDate: '2024-02-31',
    flagValue: z.boolean(),
  },
} satisfies Record<string, FlagProperties>;

export type Flag = keyof typeof featureFlags;
export type FlagValue<T extends Flag> = z.infer<
  (typeof featureFlags)[T]['flagValue']
>;
export type FlagMap = Record<Flag, FlagValue<Flag>>;

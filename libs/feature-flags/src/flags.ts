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
  GA_ADE: {
    description: 'General availability of the ADE',
    expiryDate: '2024-12-31',
    flagValue: z.boolean(),
  },
  SHOW_COMPOSIO_TOOLS: {
    description: 'Show Composio tools',
    expiryDate: '2024-12-31',
    flagValue: z.boolean(),
  },
} satisfies Record<string, FlagProperties>;

export type Flag = keyof typeof featureFlags;
export type FlagValue<T extends Flag> = z.infer<
  (typeof featureFlags)[T]['flagValue']
>;
export type FlagMap = Record<Flag, FlagValue<Flag>>;

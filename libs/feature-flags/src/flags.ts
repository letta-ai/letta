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
  SHOW_CONTEXT_EDITOR: {
    description: 'Shows the context editor in the ADE',
    expiryDate: '2024-12-31',
    flagValue: z.boolean(),
  },
  SHOW_PARAMETERS_EDITOR: {
    description: 'Shows the parameters editor in the ADE',
    expiryDate: '2024-12-31',
    flagValue: z.boolean(),
  },
  SHOW_VARIABLES_EDITOR: {
    description: 'Shows the variables editor in the ADE',
    expiryDate: '2024-12-31',
    flagValue: z.boolean(),
  },
  GA_ADE: {
    description: 'General availability of the ADE',
    expiryDate: '2024-12-31',
    flagValue: z.boolean(),
  },
} satisfies Record<string, FlagProperties>;

export type Flag = keyof typeof featureFlags;
export type FlagValue<T extends Flag> = z.infer<
  (typeof featureFlags)[T]['flagValue']
>;
export type FlagMap = Record<Flag, FlagValue<Flag>>;

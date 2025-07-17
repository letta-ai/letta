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
  DATASOURCES_V2: {
    description: 'Datasources v2',
    expiryDate: '2025-06-31',
    flagValue: z.boolean(),
  },
  LAUNCH_LINKS: {
    description: 'Launch links',
    expiryDate: '2024-01-31',
    flagValue: z.boolean(),
  },
  VOICE_SLEEPTIME_AGENT: {
    description: 'Voice sleep time agent starter kit',
    expiryDate: '2024-07-01',
    flagValue: z.boolean(),
  },
  TOOLS_ON_DASHBOARD: {
    description: 'Tools on dashboard',
    expiryDate: '2025-09-01',
    flagValue: z.boolean(),
  },
  MORE_MEMORY_FIELDS: {
    description: 'More memory fields',
    expiryDate: '2024-07-01',
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
  RECOMMENDED_MCP: {
    description: 'Recommended MCP',
    expiryDate: '2025-12-01',
    flagValue: z.boolean(),
  },
  GENERAL_ACCESS: {
    description: 'General access',
    expiryDate: '2025-07-01',
    flagValue: z.boolean(),
  },
  SHARE_AGENT_FILE: {
    description: 'Share agent file',
    expiryDate: '2025-07-01',
    flagValue: z.boolean(),
  },
  EXTERNAL_VERSION_SYNC_SETTINGS: {
    description: 'External version sync',
    expiryDate: '2025-07-01',
    flagValue: z.boolean(),
  },
  EDIT_MESSAGE: {
    description: 'Edit message',
    expiryDate: '2025-07-01',
    flagValue: z.boolean(),
  },
  SPLIT_VIEW_MEMORY_EDITOR: {
    description: 'Split view memory editor',
    expiryDate: '2025-07-01',
    flagValue: z.boolean(),
  },
  SYSTEM_WARNING: {
    flagValue: z.object({
      title: z.string(),
    }),
    description: 'System warning',
  },
  ADVANCED_MESSAGE_DEBUG: {
    description: 'Advanced message debug features',
    expiryDate: '9999-99-99',
    flagValue: z.boolean(),
  },
  TOOL_RULE_VIEWER: {
    description: 'Enable the Tool Rules Visual viewer panel',
    expiryDate: '9999-99-99',
    flagValue: z.boolean(),
  },
  DEPENDENCY_VIEWER: {
    description: 'Enable dependency viewer in tool manager',
    expiryDate: '9999-99-99',
    flagValue: z.boolean(),
  },
  PUBLIC_AGENTFILE: {
    description: 'Allow users to share an agentfile to the public',
    expiryDate: '9999-99-99',
    flagValue: z.boolean(),
  },
  QUICK_ONBOARDING: {
    description: 'Quick onboarding for new users',
    expiryDate: '2025-08-01',
    flagValue: z.boolean(),
  },
} satisfies Record<string, FlagProperties>;

export type Flag = keyof typeof featureFlags;
export type FlagValue<T extends Flag> = z.infer<
  (typeof featureFlags)[T]['flagValue']
>;
export type FlagMap = Record<Flag, FlagValue<Flag>>;

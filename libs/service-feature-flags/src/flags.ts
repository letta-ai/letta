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
  TOOLS_ON_DASHBOARD: {
    description: 'Tools on dashboard',
    expiryDate: '2025-09-01',
    flagValue: z.boolean(),
  },
  EMAIL_SIGNUP: {
    description: 'Email signup',
    expiryDate: '2024-07-01',
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
  SHOW_ERRORED_MESSAGES: {
    description: 'Show errored messages in the messages panel',
    expiryDate: '2025-08-15',
    flagValue: z.boolean(),
  },
  MEMORY_BLOCK_VIEWER: {
    description: 'Memory block viewer',
    expiryDate: '2025-08-15',
    flagValue: z.boolean(),
  },
  AI_TOOL_ASSISTANT: {
    description: 'AI Tool Assistant',
    expiryDate: '2025-08-15',
    flagValue: z.boolean(),
  },
  MCP_OAUTH: {
    description: 'Enable MCP OAuth flow using streaming endpoint',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  DATASETS: {
    description: 'Enable datasets feature',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  TYPESCRIPT_TOOLS: {
    description: 'Enable TypeScript tools',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  RUNS_PAGE: {
    description: 'Enable runs page',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  BYOK_AZURE: {
    description: 'Enable BYOK for Azure',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  BYOK_TOGETHER: {
    description: 'Enable BYOK for Together',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  AGENT_RUN_CANCELLATION_V2: {
    description: 'Enable agent run cancellation v2',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  FAVORITE_PROJECTS: {
    description: 'Enable favorite projects functionality',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  POLL_ACTIVE_RUNS_IN_SIMULATOR: {
    description: 'Enable polling active runs in simulator',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  GROUPS_UI: {
    description: 'Enable groups UI',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  RECENT_AGENTS_AND_TEMPLATES: {
    description: 'Enable recent agents and templates in the Projects dashboard',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  LLM_TOOL_SCHEMA_GENERATION: {
    description: 'LLM tool schema generation',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  BACKGROUND_MODE: {
    description: 'Continue running agent messages',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  SLEEPTIME_TEMPLATES: {
    description: 'Enable sleeptime templates',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  HUMAN_IN_THE_LOOP: {
    description: 'Enable human in the loop for agent runs',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  ENABLE_NEW_PROJECT_VIEW: {
    description: 'Enable the new project view',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
  USE_TEMPORAL_MESSAGE_ASYNC: {
    description: 'Use Temporal for message async',
    expiryDate: '2025-12-31',
    flagValue: z.boolean(),
  },
} satisfies Record<string, FlagProperties>;

export type Flag = keyof typeof featureFlags;
export type FlagValue<T extends Flag> = z.infer<
  (typeof featureFlags)[T]['flagValue']
>;
export type FlagMap = Record<Flag, FlagValue<Flag>>;

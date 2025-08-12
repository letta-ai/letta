import type { OnboardingStepsType } from '@letta-cloud/types';
import type { ToolType } from '@letta-cloud/sdk-core';

export enum AnalyticsEvent {
  USER_CREATED = 'User Created',
  USER_LOGGED_IN = 'User Logged In',
  LOCAL_AGENT_CREATED = 'Local Agent Created',
  LOCAL_AGENT_VISITED = 'Local Agent Visited',
  LOCAL_AGENT_MESSAGE_CREATED = 'Local Agent Message Created',
  LOCAL_AGENT_DATA_SOURCE_ATTACHED = 'Local Agent Data Source Attached',
  LOCAL_AGENT_DELETED = 'Local Agent Deleted',
  CLOUD_DATA_SOURCE_ATTACHED = 'Cloud Data Source Attached',
  CLOUD_AGENT_MESSAGE_CREATED = 'Cloud Agent Message Created',
  CLOUD_AGENT_DELETED = 'Cloud Agent Deleted',
  CLOUD_AGENT_MESSAGE_CREATED_IN_API = 'API Cloud Agent Message Created',
  SUBSCRIPTION_CHANGED = 'Subscription Changed',
  CREATED_PROJECT = 'Created Project',
  CREATED_TEMPLATE = 'Created Template',
  ANSWERED_ONBOARDING_SURVEY = 'Answered Onboarding Survey',
  MOVED_ONBOARDING_STEP = 'Moved Onboarding Step',
  COMPLETED_ONBOARDING = 'Completed Onboarding',
  PAUSED_ONBOARDING = 'Paused Onboarding',
  ATTEMPTED_UPGRADE = 'Upgrade Attempted',
  UPGRADE_SELECTED_PLAN = 'Selected Plan to Upgrade',
  ADDED_OWN_EXTERNAL_KEY = 'Added Own External Key',
  CREATED_API_KEY = 'Created API Key',
  CREATE_AGENT = 'agent:create',
  CREATE_TOOL = 'tool:create',
  ATTACH_TOOL = 'agent:tool:attach',
  DETACH_TOOL = 'agent:tool:detach',
  ADD_MCP_SERVER = 'tool:mcp_server:add',
  ADD_MCP_SERVER_TO_AGENT = 'agent:mcp_server:add',
  ATTACH_MCP_SERVER_TOOL = 'agent:mcp_server:attach_tool',
  DETACH_MCP_SERVER_TOOL = 'agent:mcp_server:detach_tool',
  CREATE_BLOCK_IN_CORE_MEMORY = 'agent:update:core_memory:create_block',
  ATTACH_BLOCK_TO_CORE_MEMORY = 'agent:update:core_memory:attach_block',
  DETACH_BLOCK_FROM_CORE_MEMORY = 'agent:update:core_memory:detach_block',
  UPDATE_BLOCK_IN_CORE_MEMORY = 'agent:update:core_memory:update_block',
  DELETE_BLOCK_IN_CORE_MEMORY = 'agent:update:core_memory:delete_block',
}

export interface BaseProperty {
  userId: string;
}

interface LocalAgentCreatedProperty extends BaseProperty {
  starterKitId: string;
}

interface AnsweredOnboardingSurveyProperty extends BaseProperty {
  consentedToEmailMarketing: boolean;
  reasonsForUsingLetta: string[];
  usecasesForUsingLetta: string[];
}

interface MovedOnboardingStepProperty extends BaseProperty {
  step: OnboardingStepsType;
}

interface UpgradePlanProperty extends BaseProperty {
  plan: string;
}

interface CloutAgentMessageCreatedInApiProperty {
  organizationId: string;
}

interface SubscriptionChangedProperty {
  tier: string;
  organizationId: string;
}

interface CreateAgentProperty extends BaseProperty {
  origin: string;
  starterKitId: string;
}

interface ToolProperty extends BaseProperty {
  toolType: ToolType;
}

interface AttachDetachToolProperty extends ToolProperty {
  toolId: string;
  agentId: string;
}

interface McpServer extends BaseProperty {
  agentId?: string;
  mcpServerName: string;
  mcpServerType: string;
}

interface McpAttachDetachToolProperty extends BaseProperty {
  agentId: string;
  mcpServerName: string;
  mcpToolName: string;
interface CoreMemoryProperty extends BaseProperty {
  agentId: string;
}

interface CreateCoreMemoryBlockProperty extends CoreMemoryProperty {
  blockType: string;
}

export interface AnalyticsEventProperties {
  [AnalyticsEvent.USER_LOGGED_IN]: BaseProperty;
  [AnalyticsEvent.USER_CREATED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_CREATED]: LocalAgentCreatedProperty;
  [AnalyticsEvent.LOCAL_AGENT_VISITED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_MESSAGE_CREATED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_DATA_SOURCE_ATTACHED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_DELETED]: BaseProperty;
  [AnalyticsEvent.CLOUD_DATA_SOURCE_ATTACHED]: BaseProperty;
  [AnalyticsEvent.CLOUD_AGENT_MESSAGE_CREATED]: BaseProperty;
  [AnalyticsEvent.CLOUD_AGENT_DELETED]: BaseProperty;
  [AnalyticsEvent.ANSWERED_ONBOARDING_SURVEY]: AnsweredOnboardingSurveyProperty;
  [AnalyticsEvent.MOVED_ONBOARDING_STEP]: MovedOnboardingStepProperty;
  [AnalyticsEvent.COMPLETED_ONBOARDING]: BaseProperty;
  [AnalyticsEvent.PAUSED_ONBOARDING]: BaseProperty;
  [AnalyticsEvent.ATTEMPTED_UPGRADE]: BaseProperty;
  [AnalyticsEvent.UPGRADE_SELECTED_PLAN]: UpgradePlanProperty;
  [AnalyticsEvent.CREATED_PROJECT]: BaseProperty;
  [AnalyticsEvent.CREATED_TEMPLATE]: BaseProperty;
  [AnalyticsEvent.ADDED_OWN_EXTERNAL_KEY]: BaseProperty;
  [AnalyticsEvent.CREATED_API_KEY]: BaseProperty;
  [AnalyticsEvent.CLOUD_AGENT_MESSAGE_CREATED_IN_API]: CloutAgentMessageCreatedInApiProperty;
  [AnalyticsEvent.SUBSCRIPTION_CHANGED]: SubscriptionChangedProperty;
  [AnalyticsEvent.CREATE_AGENT]: CreateAgentProperty;
  [AnalyticsEvent.CREATE_TOOL]: ToolProperty;
  [AnalyticsEvent.ATTACH_TOOL]: AttachDetachToolProperty;
  [AnalyticsEvent.DETACH_TOOL]: AttachDetachToolProperty;
  [AnalyticsEvent.ADD_MCP_SERVER]: McpServer;
  [AnalyticsEvent.ADD_MCP_SERVER_TO_AGENT]: McpServer;
  [AnalyticsEvent.ATTACH_MCP_SERVER_TOOL]: McpAttachDetachToolProperty;
  [AnalyticsEvent.DETACH_MCP_SERVER_TOOL]: McpAttachDetachToolProperty;
  [AnalyticsEvent.CREATE_BLOCK_IN_CORE_MEMORY]: CreateCoreMemoryBlockProperty;
  [AnalyticsEvent.ATTACH_BLOCK_TO_CORE_MEMORY]: CoreMemoryProperty;
  [AnalyticsEvent.DETACH_BLOCK_FROM_CORE_MEMORY]: CoreMemoryProperty;
  [AnalyticsEvent.UPDATE_BLOCK_IN_CORE_MEMORY]: CoreMemoryProperty;
  [AnalyticsEvent.DELETE_BLOCK_IN_CORE_MEMORY]: CoreMemoryProperty;
}

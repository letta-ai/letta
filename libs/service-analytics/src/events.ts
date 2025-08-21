import type { OnboardingStepsType } from '@letta-cloud/types';
import type { ToolType } from '@letta-cloud/sdk-core';

export enum AnalyticsEvent {
  USER_CREATED = 'User Created',
  USER_LOGGED_IN = 'User Logged In',
  LOCAL_AGENT_CREATED = 'Local Agent Created',
  LOCAL_AGENT_VISITED = 'Local Agent Visited',
  LOCAL_AGENT_DATA_SOURCE_ATTACHED = 'Local Agent Data Source Attached',
  LOCAL_AGENT_DELETED = 'Local Agent Deleted',
  CLOUD_DATA_SOURCE_ATTACHED = 'Cloud Data Source Attached',
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
  CREATE_AGENT = 'agent:create',
  CREATE_TOOL = 'tool:create',
  ATTACH_TOOL = 'agent:tool:attach',
  DETACH_TOOL = 'agent:tool:detach',
  ADD_MCP_SERVER = 'tool:mcp_server:add',
  ADD_MCP_SERVER_TO_AGENT = 'agent:mcp_server:add',
  DELETE_MCP_SERVER = 'tool:mcp_server:delete',
  ATTACH_MCP_SERVER_TOOL = 'agent:mcp_server:attach_tool',
  DETACH_MCP_SERVER_TOOL = 'agent:mcp_server:detach_tool',
  CREATE_BLOCK_IN_CORE_MEMORY = 'agent:update:core_memory:create_block',
  ATTACH_BLOCK_TO_CORE_MEMORY = 'agent:update:core_memory:attach_block',
  DETACH_BLOCK_FROM_CORE_MEMORY = 'agent:update:core_memory:detach_block',
  UPDATE_BLOCK_IN_CORE_MEMORY = 'agent:update:core_memory:update_block',
  DELETE_BLOCK_IN_CORE_MEMORY = 'agent:update:core_memory:delete_block',
  SEND_MESSAGE = 'agent:message:send',
  SEND_MESSAGE_FAILED = 'agent:message:failed',
  ONBOARDING_NEW_USER = 'user_onboarding:start',
  USER_ONBOARDING_STEP_COMPLETED = 'user_onboarding:step_completed',
  USER_ONBOARDING_COMPLETED = 'user_onboarding:completed',
  USER_ONBOARDING_RESOURCE_CLICKED = 'user_onboarding:resource_clicked',
  SKIP_USER_ONBOARDING = 'user_onboarding:skip',
  CREATE_API_KEY = 'user:create_api_key',
  AGENTFILE_USE_IN_LETTA_CLOUD = 'agent:agentfile:use_in_letta_cloud',
  AGENTFILE_DOWNLOAD = 'agent:agentfile:download',
  API_VISIT = 'api:visit',
}

export interface BaseProperty {
  user_id: string;
}

export interface OrganizationProperty {
  active_organization_id: string;
}

interface LocalAgentCreatedProperty {
  starter_kit_id: string;
}

interface AnsweredOnboardingSurveyProperty extends BaseProperty {
  consented_to_email_marketing: boolean;
  reasons_for_using_letta: string[];
  usecases_for_using_letta: string[];
}

interface MovedOnboardingStepProperty extends BaseProperty {
  step: OnboardingStepsType;
}

interface UpgradePlanProperty extends BaseProperty {
  plan: string;
}

interface CloutAgentMessageCreatedInApiProperty {
  organization_id: string;
}

interface SubscriptionChangedProperty {
  tier: string;
  organization_id: string;
}

interface CreateAgentProperty {
  origin: string;
  starter_kit_id: string;
}

interface ToolProperty {
  tool_type: ToolType;
}

interface CreateToolProperty extends ToolProperty {
  source_type: string;
}

interface AttachDetachToolProperty extends ToolProperty {
  tool_id: string;
  agent_id: string;
}

interface McpServer {
  agent_id?: string;
  mcp_server_name: string;
  mcp_server_type?: string;
}

interface McpAttachDetachToolProperty {
  agent_id: string;
  mcp_server_name: string;
  mcp_tool_name: string;
}

interface CoreMemoryProperty {
  agent_id: string;
}

interface CreateCoreMemoryBlockProperty extends CoreMemoryProperty {
  block_type: string;
}

interface MessageProperty {
  agent_id: string;
  message_type: string;
  message_sending_type: string;
  location: string;
}

interface OnboardingProperty {
  onboarding_type: string;
}

interface OnboardingStepProperty extends OnboardingProperty {
  onboarding_step: string;
}

interface ResourceProperty {
  resource_name: string;
}

interface OnboardingResourceProperty
  extends ResourceProperty,
    OnboardingProperty {}

interface AgentFileProperty {
  agent_id: string;
}

interface SendMessageFailedProperty extends MessageProperty {
  error_type: string;
  error_message: string;
}

interface ApiVisitProperty extends BaseProperty {
  organization_id: string;
  endpoint: string;
  method: string;
  route: string;
  body: string;
}

export interface AnalyticsEventProperties {
  [AnalyticsEvent.USER_LOGGED_IN]: BaseProperty;
  [AnalyticsEvent.USER_CREATED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_CREATED]: LocalAgentCreatedProperty;
  [AnalyticsEvent.LOCAL_AGENT_VISITED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_DATA_SOURCE_ATTACHED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_DELETED]: BaseProperty;
  [AnalyticsEvent.CLOUD_DATA_SOURCE_ATTACHED]: BaseProperty;
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
  [AnalyticsEvent.CLOUD_AGENT_MESSAGE_CREATED_IN_API]: CloutAgentMessageCreatedInApiProperty;
  [AnalyticsEvent.SUBSCRIPTION_CHANGED]: SubscriptionChangedProperty;
  [AnalyticsEvent.CREATE_AGENT]: CreateAgentProperty;
  [AnalyticsEvent.CREATE_TOOL]: CreateToolProperty;
  [AnalyticsEvent.ATTACH_TOOL]: AttachDetachToolProperty;
  [AnalyticsEvent.DETACH_TOOL]: AttachDetachToolProperty;
  [AnalyticsEvent.ADD_MCP_SERVER]: McpServer;
  [AnalyticsEvent.DELETE_MCP_SERVER]: McpServer;
  [AnalyticsEvent.ADD_MCP_SERVER_TO_AGENT]: McpServer;
  [AnalyticsEvent.ATTACH_MCP_SERVER_TOOL]: McpAttachDetachToolProperty;
  [AnalyticsEvent.DETACH_MCP_SERVER_TOOL]: McpAttachDetachToolProperty;
  [AnalyticsEvent.CREATE_BLOCK_IN_CORE_MEMORY]: CreateCoreMemoryBlockProperty;
  [AnalyticsEvent.ATTACH_BLOCK_TO_CORE_MEMORY]: CoreMemoryProperty;
  [AnalyticsEvent.DETACH_BLOCK_FROM_CORE_MEMORY]: CoreMemoryProperty;
  [AnalyticsEvent.UPDATE_BLOCK_IN_CORE_MEMORY]: CoreMemoryProperty;
  [AnalyticsEvent.DELETE_BLOCK_IN_CORE_MEMORY]: CoreMemoryProperty;
  [AnalyticsEvent.SEND_MESSAGE]: MessageProperty;
  [AnalyticsEvent.ONBOARDING_NEW_USER]: OnboardingProperty;
  [AnalyticsEvent.USER_ONBOARDING_STEP_COMPLETED]: OnboardingStepProperty;
  [AnalyticsEvent.USER_ONBOARDING_COMPLETED]: OnboardingStepProperty;
  [AnalyticsEvent.USER_ONBOARDING_RESOURCE_CLICKED]: OnboardingResourceProperty;
  [AnalyticsEvent.SKIP_USER_ONBOARDING]: OnboardingProperty;
  [AnalyticsEvent.CREATE_API_KEY]: OrganizationProperty;
  [AnalyticsEvent.SEND_MESSAGE_FAILED]: SendMessageFailedProperty;
  [AnalyticsEvent.AGENTFILE_USE_IN_LETTA_CLOUD]: AgentFileProperty;
  [AnalyticsEvent.AGENTFILE_DOWNLOAD]: AgentFileProperty;
  [AnalyticsEvent.API_VISIT]: ApiVisitProperty;
}

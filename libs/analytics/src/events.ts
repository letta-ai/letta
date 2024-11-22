export enum AnalyticsEvent {
  USER_CREATED = 'User Created',
  USER_LOGGED_IN = 'User Logged In',
  LOCAL_AGENT_CREATED = 'Local Agent Created',
  LOCAL_AGENT_VISITED = 'Local Agent Visited',
  LOCAL_AGENT_MESSAGE_CREATED = 'Local Agent Message Created',
  LOCAL_AGENT_DATA_SOURCE_ATTACHED = 'Local Agent Data Source Attached',
  LOCAL_AGENT_DATA_SOURCE_DETACHED = 'Local Agent Data Source Detached',
  LOCAL_AGENT_MODEL_CHANGED = 'Local Agent Model Changed',
  LOCAL_AGENT_DELETED = 'Local Agent Deleted',
  CLOUD_DATA_SOURCE_ATTACHED = 'Cloud Data Source Attached',
  CLOUD_DATA_SOURCE_DETACHED = 'Cloud Data Source Detached',
  CLOUD_AGENT_CREATED = 'Cloud Agent Created',
  CLOUD_AGENT_VISITED = 'Cloud Agent Visited',
  CLOUD_AGENT_MESSAGE_CREATED = 'Cloud Agent Message Created',
  CLOUD_AGENT_MODEL_CHANGED = 'Cloud Agent Model Changed',
  CLOUD_AGENT_DELETED = 'Cloud Agent Deleted',
  AGENT_CREATED = 'Agent Created',
  AGENT_STAGED = 'Agent Staged',
  AGENT_DEPLOYED = 'Agent Deployed',
}

export interface BaseProperty {
  userId: string;
}

interface LocalAgentCreatedProperty extends BaseProperty {
  starterKitId: string;
}

interface LocalAgentModelChangedProperty extends BaseProperty {
  model: string;
}

export interface AnalyticsEventProperties {
  [AnalyticsEvent.AGENT_CREATED]: BaseProperty;
  [AnalyticsEvent.USER_LOGGED_IN]: BaseProperty;
  [AnalyticsEvent.AGENT_STAGED]: BaseProperty;
  [AnalyticsEvent.AGENT_DEPLOYED]: BaseProperty;
  [AnalyticsEvent.USER_CREATED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_CREATED]: LocalAgentCreatedProperty;
  [AnalyticsEvent.LOCAL_AGENT_VISITED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_MESSAGE_CREATED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_DATA_SOURCE_ATTACHED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_DATA_SOURCE_DETACHED]: BaseProperty;
  [AnalyticsEvent.LOCAL_AGENT_MODEL_CHANGED]: LocalAgentModelChangedProperty;
  [AnalyticsEvent.LOCAL_AGENT_DELETED]: BaseProperty;
  [AnalyticsEvent.CLOUD_DATA_SOURCE_ATTACHED]: BaseProperty;
  [AnalyticsEvent.CLOUD_DATA_SOURCE_DETACHED]: BaseProperty;
  [AnalyticsEvent.CLOUD_AGENT_CREATED]: BaseProperty;
  [AnalyticsEvent.CLOUD_AGENT_VISITED]: BaseProperty;
  [AnalyticsEvent.CLOUD_AGENT_MESSAGE_CREATED]: BaseProperty;
  [AnalyticsEvent.CLOUD_AGENT_MODEL_CHANGED]: LocalAgentModelChangedProperty;
  [AnalyticsEvent.CLOUD_AGENT_DELETED]: BaseProperty;
}

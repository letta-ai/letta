export enum AnalyticsEvent {
  USER_CREATED = 'User Created',
  USER_LOGGED_IN = 'User Logged In',
  AGENT_CREATED = 'Agent Created',
  AGENT_STAGED = 'Agent Staged',
  AGENT_DEPLOYED = 'Agent Deployed',
}

export interface BaseProperty {
  userId: string;
}

export interface AnalyticsEventProperties {
  [AnalyticsEvent.AGENT_CREATED]: BaseProperty;
  [AnalyticsEvent.USER_LOGGED_IN]: BaseProperty;
  [AnalyticsEvent.AGENT_STAGED]: BaseProperty;
  [AnalyticsEvent.AGENT_DEPLOYED]: BaseProperty;
  [AnalyticsEvent.USER_CREATED]: BaseProperty;
}

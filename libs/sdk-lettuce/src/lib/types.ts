export interface MigrateAgentsPayload {
  memoryVariables?: Record<string, string>;
  preserveCoreMemories?: boolean;
  agentIds?: string[];
  template: string;
  coreUserId: string;
  organizationId: string;
}

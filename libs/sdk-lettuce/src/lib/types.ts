import type { VersionStringWithProject } from '@letta-cloud/utils-shared';

export interface MigrateTemplateEntitiesPayload {
  preserveToolVariables?: boolean;
  preserveCoreMemories?: boolean;
  versionString: VersionStringWithProject;
  organizationId: string;
  lettaAgentsId: string;
  batchSize?: number; // Default to 25 if not specified
}

export interface MigrateSingleAgentPayload {
  agentId: string;
  preserveToolVariables?: boolean;
  preserveCoreMemories?: boolean;
  versionString: VersionStringWithProject;
  organizationId: string;
  lettaAgentsId: string;
}

export interface MigrateBatchPayload {
  agents: Array<{
    agentId: string;
    variables: Record<string, string>;
  }>;
  preserveToolVariables?: boolean;
  preserveCoreMemories?: boolean;
  versionString: VersionStringWithProject;
  organizationId: string;
  lettaAgentsId: string;
  batchNumber: number;
}

export interface MigrateBatchResult {
  successful: number;
  failed: number;
  total: number;
  batchNumber: number;
  failedAgentIds: string[];
}

export interface UpdateAgentFromAgentTemplateIdPayload {
  agentId: string;
  agentTemplateId: string;
  preserveToolVariables?: boolean;
  preserveCoreMemories?: boolean;
  organizationId: string;
  lettaAgentsId: string;
  templateId: string;
}

export interface MigrateDeploymentEntitiesPayload {
  deploymentId: string;
  templateId: string;
  preserveToolVariables?: boolean;
  preserveCoreMemories?: boolean;
  organizationId: string;
  lettaAgentsId: string;
  baseTemplateId?: string;
  memoryVariables?: Record<string, string>;
}

export interface MigrateAllDeploymentsByBaseTemplateIdPayload {
  baseTemplateId: string;
  organizationId: string;
  lettaAgentsId: string;
  preserveToolVariables?: boolean;
  preserveCoreMemories?: boolean;
  memoryVariables?: Record<string, string>;
  batchSize?: number;
}

export interface DeleteExpiredTokensAndUsersResult {
  expiredTokens: number;
  deletedTokens: number;
  deletedUsers: number;
  failedUserIds: string[];
}

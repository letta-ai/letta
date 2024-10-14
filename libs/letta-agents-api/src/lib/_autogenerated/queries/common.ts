// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryResult } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
  AuthService,
  BlocksService,
  HealthService,
  JobsService,
  LlmsService,
  ModelsService,
  OrganizationService,
  SourcesService,
  ToolsService,
  UsersService,
} from '../requests/services.gen';
export type ToolsServiceGetToolDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.getTool>
>;
export type ToolsServiceGetToolQueryResult<
  TData = ToolsServiceGetToolDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useToolsServiceGetToolKey = 'ToolsServiceGetTool';
export const UseToolsServiceGetToolKeyFn = (
  {
    toolId,
  }: {
    toolId: string;
  },
  queryKey?: Array<unknown>
) => [useToolsServiceGetToolKey, ...(queryKey ?? [{ toolId }])];
export type ToolsServiceGetToolIdByNameDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.getToolIdByName>
>;
export type ToolsServiceGetToolIdByNameQueryResult<
  TData = ToolsServiceGetToolIdByNameDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useToolsServiceGetToolIdByNameKey = 'ToolsServiceGetToolIdByName';
export const UseToolsServiceGetToolIdByNameKeyFn = (
  {
    toolName,
    userId,
  }: {
    toolName: string;
    userId?: string;
  },
  queryKey?: Array<unknown>
) => [
  useToolsServiceGetToolIdByNameKey,
  ...(queryKey ?? [{ toolName, userId }]),
];
export type ToolsServiceListToolsDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.listTools>
>;
export type ToolsServiceListToolsQueryResult<
  TData = ToolsServiceListToolsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useToolsServiceListToolsKey = 'ToolsServiceListTools';
export const UseToolsServiceListToolsKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>
) => [useToolsServiceListToolsKey, ...(queryKey ?? [{ userId }])];
export type SourcesServiceGetSourceDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.getSource>
>;
export type SourcesServiceGetSourceQueryResult<
  TData = SourcesServiceGetSourceDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceGetSourceKey = 'SourcesServiceGetSource';
export const UseSourcesServiceGetSourceKeyFn = (
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>
) => [useSourcesServiceGetSourceKey, ...(queryKey ?? [{ sourceId, userId }])];
export type SourcesServiceGetSourceIdByNameDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.getSourceIdByName>
>;
export type SourcesServiceGetSourceIdByNameQueryResult<
  TData = SourcesServiceGetSourceIdByNameDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceGetSourceIdByNameKey =
  'SourcesServiceGetSourceIdByName';
export const UseSourcesServiceGetSourceIdByNameKeyFn = (
  {
    sourceName,
    userId,
  }: {
    sourceName: string;
    userId?: string;
  },
  queryKey?: Array<unknown>
) => [
  useSourcesServiceGetSourceIdByNameKey,
  ...(queryKey ?? [{ sourceName, userId }]),
];
export type SourcesServiceListSourcesDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.listSources>
>;
export type SourcesServiceListSourcesQueryResult<
  TData = SourcesServiceListSourcesDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceListSourcesKey = 'SourcesServiceListSources';
export const UseSourcesServiceListSourcesKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>
) => [useSourcesServiceListSourcesKey, ...(queryKey ?? [{ userId }])];
export type SourcesServiceListSourcePassagesDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.listSourcePassages>
>;
export type SourcesServiceListSourcePassagesQueryResult<
  TData = SourcesServiceListSourcePassagesDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceListSourcePassagesKey =
  'SourcesServiceListSourcePassages';
export const UseSourcesServiceListSourcePassagesKeyFn = (
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>
) => [
  useSourcesServiceListSourcePassagesKey,
  ...(queryKey ?? [{ sourceId, userId }]),
];
export type SourcesServiceListFilesFromSourceDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.listFilesFromSource>
>;
export type SourcesServiceListFilesFromSourceQueryResult<
  TData = SourcesServiceListFilesFromSourceDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceListFilesFromSourceKey =
  'SourcesServiceListFilesFromSource';
export const UseSourcesServiceListFilesFromSourceKeyFn = (
  {
    cursor,
    limit,
    sourceId,
    userId,
  }: {
    cursor?: string;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>
) => [
  useSourcesServiceListFilesFromSourceKey,
  ...(queryKey ?? [{ cursor, limit, sourceId, userId }]),
];
export type AgentsServiceListAgentsDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgents>
>;
export type AgentsServiceListAgentsQueryResult<
  TData = AgentsServiceListAgentsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentsKey = 'AgentsServiceListAgents';
export const UseAgentsServiceListAgentsKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>
) => [useAgentsServiceListAgentsKey, ...(queryKey ?? [{ userId }])];
export type AgentsServiceGetAgentDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.getAgent>
>;
export type AgentsServiceGetAgentQueryResult<
  TData = AgentsServiceGetAgentDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentKey = 'AgentsServiceGetAgent';
export const UseAgentsServiceGetAgentKeyFn = (
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>
) => [useAgentsServiceGetAgentKey, ...(queryKey ?? [{ agentId, userId }])];
export type AgentsServiceGetAgentSourcesDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.getAgentSources>
>;
export type AgentsServiceGetAgentSourcesQueryResult<
  TData = AgentsServiceGetAgentSourcesDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentSourcesKey =
  'AgentsServiceGetAgentSources';
export const UseAgentsServiceGetAgentSourcesKeyFn = (
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: Array<unknown>
) => [useAgentsServiceGetAgentSourcesKey, ...(queryKey ?? [{ agentId }])];
export type AgentsServiceListAgentInContextMessagesDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentInContextMessages>
>;
export type AgentsServiceListAgentInContextMessagesQueryResult<
  TData = AgentsServiceListAgentInContextMessagesDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentInContextMessagesKey =
  'AgentsServiceListAgentInContextMessages';
export const UseAgentsServiceListAgentInContextMessagesKeyFn = (
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: Array<unknown>
) => [
  useAgentsServiceListAgentInContextMessagesKey,
  ...(queryKey ?? [{ agentId }]),
];
export type AgentsServiceGetAgentMemoryDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.getAgentMemory>
>;
export type AgentsServiceGetAgentMemoryQueryResult<
  TData = AgentsServiceGetAgentMemoryDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentMemoryKey = 'AgentsServiceGetAgentMemory';
export const UseAgentsServiceGetAgentMemoryKeyFn = (
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: Array<unknown>
) => [useAgentsServiceGetAgentMemoryKey, ...(queryKey ?? [{ agentId }])];
export type AgentsServiceGetAgentRecallMemorySummaryDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.getAgentRecallMemorySummary>
>;
export type AgentsServiceGetAgentRecallMemorySummaryQueryResult<
  TData = AgentsServiceGetAgentRecallMemorySummaryDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentRecallMemorySummaryKey =
  'AgentsServiceGetAgentRecallMemorySummary';
export const UseAgentsServiceGetAgentRecallMemorySummaryKeyFn = (
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: Array<unknown>
) => [
  useAgentsServiceGetAgentRecallMemorySummaryKey,
  ...(queryKey ?? [{ agentId }]),
];
export type AgentsServiceGetAgentArchivalMemorySummaryDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.getAgentArchivalMemorySummary>
>;
export type AgentsServiceGetAgentArchivalMemorySummaryQueryResult<
  TData = AgentsServiceGetAgentArchivalMemorySummaryDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentArchivalMemorySummaryKey =
  'AgentsServiceGetAgentArchivalMemorySummary';
export const UseAgentsServiceGetAgentArchivalMemorySummaryKeyFn = (
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: Array<unknown>
) => [
  useAgentsServiceGetAgentArchivalMemorySummaryKey,
  ...(queryKey ?? [{ agentId }]),
];
export type AgentsServiceListAgentArchivalMemoryDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentArchivalMemory>
>;
export type AgentsServiceListAgentArchivalMemoryQueryResult<
  TData = AgentsServiceListAgentArchivalMemoryDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentArchivalMemoryKey =
  'AgentsServiceListAgentArchivalMemory';
export const UseAgentsServiceListAgentArchivalMemoryKeyFn = (
  {
    after,
    agentId,
    before,
    limit,
    userId,
  }: {
    after?: number;
    agentId: string;
    before?: number;
    limit?: number;
    userId?: string;
  },
  queryKey?: Array<unknown>
) => [
  useAgentsServiceListAgentArchivalMemoryKey,
  ...(queryKey ?? [{ after, agentId, before, limit, userId }]),
];
export type AgentsServiceListAgentMessagesDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentMessages>
>;
export type AgentsServiceListAgentMessagesQueryResult<
  TData = AgentsServiceListAgentMessagesDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentMessagesKey =
  'AgentsServiceListAgentMessages';
export const UseAgentsServiceListAgentMessagesKeyFn = (
  {
    agentId,
    assistantMessageFunctionKwarg,
    assistantMessageFunctionName,
    before,
    limit,
    msgObject,
    useAssistantMessage,
    userId,
  }: {
    agentId: string;
    assistantMessageFunctionKwarg?: string;
    assistantMessageFunctionName?: string;
    before?: string;
    limit?: number;
    msgObject?: boolean;
    useAssistantMessage?: boolean;
    userId?: string;
  },
  queryKey?: Array<unknown>
) => [
  useAgentsServiceListAgentMessagesKey,
  ...(queryKey ?? [
    {
      agentId,
      assistantMessageFunctionKwarg,
      assistantMessageFunctionName,
      before,
      limit,
      msgObject,
      useAssistantMessage,
      userId,
    },
  ]),
];
export type ModelsServiceListModelsDefaultResponse = Awaited<
  ReturnType<typeof ModelsService.listModels>
>;
export type ModelsServiceListModelsQueryResult<
  TData = ModelsServiceListModelsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useModelsServiceListModelsKey = 'ModelsServiceListModels';
export const UseModelsServiceListModelsKeyFn = (queryKey?: Array<unknown>) => [
  useModelsServiceListModelsKey,
  ...(queryKey ?? []),
];
export type ModelsServiceListEmbeddingModelsDefaultResponse = Awaited<
  ReturnType<typeof ModelsService.listEmbeddingModels>
>;
export type ModelsServiceListEmbeddingModelsQueryResult<
  TData = ModelsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useModelsServiceListEmbeddingModelsKey =
  'ModelsServiceListEmbeddingModels';
export const UseModelsServiceListEmbeddingModelsKeyFn = (
  queryKey?: Array<unknown>
) => [useModelsServiceListEmbeddingModelsKey, ...(queryKey ?? [])];
export type LlmsServiceListModelsDefaultResponse = Awaited<
  ReturnType<typeof LlmsService.listModels>
>;
export type LlmsServiceListModelsQueryResult<
  TData = LlmsServiceListModelsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useLlmsServiceListModelsKey = 'LlmsServiceListModels';
export const UseLlmsServiceListModelsKeyFn = (queryKey?: Array<unknown>) => [
  useLlmsServiceListModelsKey,
  ...(queryKey ?? []),
];
export type LlmsServiceListEmbeddingModelsDefaultResponse = Awaited<
  ReturnType<typeof LlmsService.listEmbeddingModels>
>;
export type LlmsServiceListEmbeddingModelsQueryResult<
  TData = LlmsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useLlmsServiceListEmbeddingModelsKey =
  'LlmsServiceListEmbeddingModels';
export const UseLlmsServiceListEmbeddingModelsKeyFn = (
  queryKey?: Array<unknown>
) => [useLlmsServiceListEmbeddingModelsKey, ...(queryKey ?? [])];
export type BlocksServiceListMemoryBlocksDefaultResponse = Awaited<
  ReturnType<typeof BlocksService.listMemoryBlocks>
>;
export type BlocksServiceListMemoryBlocksQueryResult<
  TData = BlocksServiceListMemoryBlocksDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useBlocksServiceListMemoryBlocksKey =
  'BlocksServiceListMemoryBlocks';
export const UseBlocksServiceListMemoryBlocksKeyFn = (
  {
    label,
    name,
    templatesOnly,
    userId,
  }: {
    label?: string;
    name?: string;
    templatesOnly?: boolean;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>
) => [
  useBlocksServiceListMemoryBlocksKey,
  ...(queryKey ?? [{ label, name, templatesOnly, userId }]),
];
export type BlocksServiceGetMemoryBlockDefaultResponse = Awaited<
  ReturnType<typeof BlocksService.getMemoryBlock>
>;
export type BlocksServiceGetMemoryBlockQueryResult<
  TData = BlocksServiceGetMemoryBlockDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useBlocksServiceGetMemoryBlockKey = 'BlocksServiceGetMemoryBlock';
export const UseBlocksServiceGetMemoryBlockKeyFn = (
  {
    blockId,
  }: {
    blockId: string;
  },
  queryKey?: Array<unknown>
) => [useBlocksServiceGetMemoryBlockKey, ...(queryKey ?? [{ blockId }])];
export type JobsServiceListJobsDefaultResponse = Awaited<
  ReturnType<typeof JobsService.listJobs>
>;
export type JobsServiceListJobsQueryResult<
  TData = JobsServiceListJobsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useJobsServiceListJobsKey = 'JobsServiceListJobs';
export const UseJobsServiceListJobsKeyFn = (
  {
    sourceId,
    userId,
  }: {
    sourceId?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>
) => [useJobsServiceListJobsKey, ...(queryKey ?? [{ sourceId, userId }])];
export type JobsServiceListActiveJobsDefaultResponse = Awaited<
  ReturnType<typeof JobsService.listActiveJobs>
>;
export type JobsServiceListActiveJobsQueryResult<
  TData = JobsServiceListActiveJobsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useJobsServiceListActiveJobsKey = 'JobsServiceListActiveJobs';
export const UseJobsServiceListActiveJobsKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>
) => [useJobsServiceListActiveJobsKey, ...(queryKey ?? [{ userId }])];
export type JobsServiceGetJobDefaultResponse = Awaited<
  ReturnType<typeof JobsService.getJob>
>;
export type JobsServiceGetJobQueryResult<
  TData = JobsServiceGetJobDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useJobsServiceGetJobKey = 'JobsServiceGetJob';
export const UseJobsServiceGetJobKeyFn = (
  {
    jobId,
  }: {
    jobId: string;
  },
  queryKey?: Array<unknown>
) => [useJobsServiceGetJobKey, ...(queryKey ?? [{ jobId }])];
export type HealthServiceHealthCheckDefaultResponse = Awaited<
  ReturnType<typeof HealthService.healthCheck>
>;
export type HealthServiceHealthCheckQueryResult<
  TData = HealthServiceHealthCheckDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useHealthServiceHealthCheckKey = 'HealthServiceHealthCheck';
export const UseHealthServiceHealthCheckKeyFn = (queryKey?: Array<unknown>) => [
  useHealthServiceHealthCheckKey,
  ...(queryKey ?? []),
];
export type UsersServiceListUsersDefaultResponse = Awaited<
  ReturnType<typeof UsersService.listUsers>
>;
export type UsersServiceListUsersQueryResult<
  TData = UsersServiceListUsersDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useUsersServiceListUsersKey = 'UsersServiceListUsers';
export const UseUsersServiceListUsersKeyFn = (
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>
) => [useUsersServiceListUsersKey, ...(queryKey ?? [{ cursor, limit }])];
export type UsersServiceListApiKeysDefaultResponse = Awaited<
  ReturnType<typeof UsersService.listApiKeys>
>;
export type UsersServiceListApiKeysQueryResult<
  TData = UsersServiceListApiKeysDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useUsersServiceListApiKeysKey = 'UsersServiceListApiKeys';
export const UseUsersServiceListApiKeysKeyFn = (
  {
    userId,
  }: {
    userId: string;
  },
  queryKey?: Array<unknown>
) => [useUsersServiceListApiKeysKey, ...(queryKey ?? [{ userId }])];
export type AdminServiceListUsersDefaultResponse = Awaited<
  ReturnType<typeof AdminService.listUsers>
>;
export type AdminServiceListUsersQueryResult<
  TData = AdminServiceListUsersDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAdminServiceListUsersKey = 'AdminServiceListUsers';
export const UseAdminServiceListUsersKeyFn = (
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>
) => [useAdminServiceListUsersKey, ...(queryKey ?? [{ cursor, limit }])];
export type AdminServiceListApiKeysDefaultResponse = Awaited<
  ReturnType<typeof AdminService.listApiKeys>
>;
export type AdminServiceListApiKeysQueryResult<
  TData = AdminServiceListApiKeysDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAdminServiceListApiKeysKey = 'AdminServiceListApiKeys';
export const UseAdminServiceListApiKeysKeyFn = (
  {
    userId,
  }: {
    userId: string;
  },
  queryKey?: Array<unknown>
) => [useAdminServiceListApiKeysKey, ...(queryKey ?? [{ userId }])];
export type AdminServiceListOrgsDefaultResponse = Awaited<
  ReturnType<typeof AdminService.listOrgs>
>;
export type AdminServiceListOrgsQueryResult<
  TData = AdminServiceListOrgsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAdminServiceListOrgsKey = 'AdminServiceListOrgs';
export const UseAdminServiceListOrgsKeyFn = (
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>
) => [useAdminServiceListOrgsKey, ...(queryKey ?? [{ cursor, limit }])];
export type OrganizationServiceListOrgsDefaultResponse = Awaited<
  ReturnType<typeof OrganizationService.listOrgs>
>;
export type OrganizationServiceListOrgsQueryResult<
  TData = OrganizationServiceListOrgsDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useOrganizationServiceListOrgsKey = 'OrganizationServiceListOrgs';
export const UseOrganizationServiceListOrgsKeyFn = (
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>
) => [useOrganizationServiceListOrgsKey, ...(queryKey ?? [{ cursor, limit }])];
export type ToolsServiceCreateToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.createTool>
>;
export type SourcesServiceCreateSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.createSource>
>;
export type SourcesServiceAttachAgentToSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.attachAgentToSource>
>;
export type SourcesServiceDetachAgentFromSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.detachAgentFromSource>
>;
export type SourcesServiceUploadFileToSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.uploadFileToSource>
>;
export type AgentsServiceCreateAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.createAgent>
>;
export type AgentsServiceCreateAgentArchivalMemoryMutationResult = Awaited<
  ReturnType<typeof AgentsService.createAgentArchivalMemory>
>;
export type AgentsServiceCreateAgentMessageMutationResult = Awaited<
  ReturnType<typeof AgentsService.createAgentMessage>
>;
export type BlocksServiceCreateMemoryBlockMutationResult = Awaited<
  ReturnType<typeof BlocksService.createMemoryBlock>
>;
export type UsersServiceCreateUserMutationResult = Awaited<
  ReturnType<typeof UsersService.createUser>
>;
export type UsersServiceCreateApiKeyMutationResult = Awaited<
  ReturnType<typeof UsersService.createApiKey>
>;
export type AdminServiceCreateUserMutationResult = Awaited<
  ReturnType<typeof AdminService.createUser>
>;
export type AdminServiceCreateApiKeyMutationResult = Awaited<
  ReturnType<typeof AdminService.createApiKey>
>;
export type AdminServiceCreateOrganizationMutationResult = Awaited<
  ReturnType<typeof AdminService.createOrganization>
>;
export type OrganizationServiceCreateOrganizationMutationResult = Awaited<
  ReturnType<typeof OrganizationService.createOrganization>
>;
export type AuthServiceAuthenticateUserV1AuthPostMutationResult = Awaited<
  ReturnType<typeof AuthService.authenticateUserV1AuthPost>
>;
export type ToolsServiceUpdateToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.updateTool>
>;
export type SourcesServiceUpdateSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.updateSource>
>;
export type AgentsServiceUpdateAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.updateAgent>
>;
export type AgentsServiceUpdateAgentMemoryMutationResult = Awaited<
  ReturnType<typeof AgentsService.updateAgentMemory>
>;
export type AgentsServiceUpdateAgentMessageMutationResult = Awaited<
  ReturnType<typeof AgentsService.updateAgentMessage>
>;
export type BlocksServiceUpdateMemoryBlockMutationResult = Awaited<
  ReturnType<typeof BlocksService.updateMemoryBlock>
>;
export type ToolsServiceDeleteToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.deleteTool>
>;
export type SourcesServiceDeleteSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.deleteSource>
>;
export type AgentsServiceDeleteAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.deleteAgent>
>;
export type AgentsServiceDeleteAgentArchivalMemoryMutationResult = Awaited<
  ReturnType<typeof AgentsService.deleteAgentArchivalMemory>
>;
export type BlocksServiceDeleteMemoryBlockMutationResult = Awaited<
  ReturnType<typeof BlocksService.deleteMemoryBlock>
>;
export type JobsServiceDeleteJobMutationResult = Awaited<
  ReturnType<typeof JobsService.deleteJob>
>;
export type UsersServiceDeleteUserMutationResult = Awaited<
  ReturnType<typeof UsersService.deleteUser>
>;
export type UsersServiceDeleteApiKeyMutationResult = Awaited<
  ReturnType<typeof UsersService.deleteApiKey>
>;
export type AdminServiceDeleteUserMutationResult = Awaited<
  ReturnType<typeof AdminService.deleteUser>
>;
export type AdminServiceDeleteApiKeyMutationResult = Awaited<
  ReturnType<typeof AdminService.deleteApiKey>
>;
export type AdminServiceDeleteOrganizationMutationResult = Awaited<
  ReturnType<typeof AdminService.deleteOrganization>
>;
export type OrganizationServiceDeleteOrganizationMutationResult = Awaited<
  ReturnType<typeof OrganizationService.deleteOrganization>
>;

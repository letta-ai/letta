// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryResult } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
  AuthService,
  BlocksService,
  GroupsService,
  HealthService,
  IdentitiesService,
  JobsService,
  LlmsService,
  ModelsService,
  OrganizationService,
  ProvidersService,
  RunsService,
  SandboxConfigService,
  SourcesService,
  StepsService,
  TagService,
  ToolsService,
  UsersService,
  VoiceService,
} from '../requests/services.gen';
import {
  AgentSchema,
  IdentityType,
  ManagerType,
  MessageRole,
  SandboxType,
} from '../requests/types.gen';
export type ToolsServiceRetrieveToolDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.retrieveTool>
>;
export type ToolsServiceRetrieveToolQueryResult<
  TData = ToolsServiceRetrieveToolDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useToolsServiceRetrieveToolKey = 'ToolsServiceRetrieveTool';
export const UseToolsServiceRetrieveToolKeyFn = (
  {
    toolId,
    userId,
  }: {
    toolId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [useToolsServiceRetrieveToolKey, ...(queryKey ?? [{ toolId, userId }])];
export type ToolsServiceListToolsDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.listTools>
>;
export type ToolsServiceListToolsQueryResult<
  TData = ToolsServiceListToolsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useToolsServiceListToolsKey = 'ToolsServiceListTools';
export const UseToolsServiceListToolsKeyFn = (
  {
    after,
    limit,
    name,
    userId,
  }: {
    after?: string;
    limit?: number;
    name?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useToolsServiceListToolsKey,
  ...(queryKey ?? [{ after, limit, name, userId }]),
];
export type ToolsServiceListComposioAppsDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.listComposioApps>
>;
export type ToolsServiceListComposioAppsQueryResult<
  TData = ToolsServiceListComposioAppsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useToolsServiceListComposioAppsKey =
  'ToolsServiceListComposioApps';
export const UseToolsServiceListComposioAppsKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useToolsServiceListComposioAppsKey, ...(queryKey ?? [{ userId }])];
export type ToolsServiceListComposioActionsByAppDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.listComposioActionsByApp>
>;
export type ToolsServiceListComposioActionsByAppQueryResult<
  TData = ToolsServiceListComposioActionsByAppDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useToolsServiceListComposioActionsByAppKey =
  'ToolsServiceListComposioActionsByApp';
export const UseToolsServiceListComposioActionsByAppKeyFn = (
  {
    composioAppName,
    userId,
  }: {
    composioAppName: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useToolsServiceListComposioActionsByAppKey,
  ...(queryKey ?? [{ composioAppName, userId }]),
];
export type ToolsServiceListMcpServersDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.listMcpServers>
>;
export type ToolsServiceListMcpServersQueryResult<
  TData = ToolsServiceListMcpServersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useToolsServiceListMcpServersKey = 'ToolsServiceListMcpServers';
export const UseToolsServiceListMcpServersKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useToolsServiceListMcpServersKey, ...(queryKey ?? [{ userId }])];
export type ToolsServiceListMcpToolsByServerDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.listMcpToolsByServer>
>;
export type ToolsServiceListMcpToolsByServerQueryResult<
  TData = ToolsServiceListMcpToolsByServerDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useToolsServiceListMcpToolsByServerKey =
  'ToolsServiceListMcpToolsByServer';
export const UseToolsServiceListMcpToolsByServerKeyFn = (
  {
    mcpServerName,
    userId,
  }: {
    mcpServerName: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useToolsServiceListMcpToolsByServerKey,
  ...(queryKey ?? [{ mcpServerName, userId }]),
];
export type SourcesServiceRetrieveSourceDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.retrieveSource>
>;
export type SourcesServiceRetrieveSourceQueryResult<
  TData = SourcesServiceRetrieveSourceDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSourcesServiceRetrieveSourceKey =
  'SourcesServiceRetrieveSource';
export const UseSourcesServiceRetrieveSourceKeyFn = (
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceRetrieveSourceKey,
  ...(queryKey ?? [{ sourceId, userId }]),
];
export type SourcesServiceGetSourceIdByNameDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.getSourceIdByName>
>;
export type SourcesServiceGetSourceIdByNameQueryResult<
  TData = SourcesServiceGetSourceIdByNameDefaultResponse,
  TError = unknown,
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
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceGetSourceIdByNameKey,
  ...(queryKey ?? [{ sourceName, userId }]),
];
export type SourcesServiceListSourcesDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.listSources>
>;
export type SourcesServiceListSourcesQueryResult<
  TData = SourcesServiceListSourcesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSourcesServiceListSourcesKey = 'SourcesServiceListSources';
export const UseSourcesServiceListSourcesKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useSourcesServiceListSourcesKey, ...(queryKey ?? [{ userId }])];
export type SourcesServiceListSourcePassagesDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.listSourcePassages>
>;
export type SourcesServiceListSourcePassagesQueryResult<
  TData = SourcesServiceListSourcePassagesDefaultResponse,
  TError = unknown,
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
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceListSourcePassagesKey,
  ...(queryKey ?? [{ sourceId, userId }]),
];
export type SourcesServiceListSourceFilesDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.listSourceFiles>
>;
export type SourcesServiceListSourceFilesQueryResult<
  TData = SourcesServiceListSourceFilesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSourcesServiceListSourceFilesKey =
  'SourcesServiceListSourceFiles';
export const UseSourcesServiceListSourceFilesKeyFn = (
  {
    after,
    limit,
    sourceId,
    userId,
  }: {
    after?: string;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceListSourceFilesKey,
  ...(queryKey ?? [{ after, limit, sourceId, userId }]),
];
export type AgentsServiceListAgentsDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgents>
>;
export type AgentsServiceListAgentsQueryResult<
  TData = AgentsServiceListAgentsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentsKey = 'AgentsServiceListAgents';
export const UseAgentsServiceListAgentsKeyFn = (
  {
    after,
    ascending,
    baseTemplateId,
    before,
    identifierKeys,
    identityId,
    includeRelationships,
    limit,
    matchAllTags,
    name,
    projectId,
    queryText,
    tags,
    templateId,
    userId,
  }: {
    after?: string;
    ascending?: boolean;
    baseTemplateId?: string;
    before?: string;
    identifierKeys?: string[];
    identityId?: string;
    includeRelationships?: string[];
    limit?: number;
    matchAllTags?: boolean;
    name?: string;
    projectId?: string;
    queryText?: string;
    tags?: string[];
    templateId?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentsKey,
  ...(queryKey ?? [
    {
      after,
      ascending,
      baseTemplateId,
      before,
      identifierKeys,
      identityId,
      includeRelationships,
      limit,
      matchAllTags,
      name,
      projectId,
      queryText,
      tags,
      templateId,
      userId,
    },
  ]),
];
export type AgentsServiceExportAgentSerializedDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.exportAgentSerialized>
>;
export type AgentsServiceExportAgentSerializedQueryResult<
  TData = AgentsServiceExportAgentSerializedDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceExportAgentSerializedKey =
  'AgentsServiceExportAgentSerialized';
export const UseAgentsServiceExportAgentSerializedKeyFn = (
  {
    agentId,
    requestBody,
    userId,
  }: {
    agentId: string;
    requestBody?: AgentSchema;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceExportAgentSerializedKey,
  ...(queryKey ?? [{ agentId, requestBody, userId }]),
];
export type AgentsServiceRetrieveAgentContextWindowDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.retrieveAgentContextWindow>
>;
export type AgentsServiceRetrieveAgentContextWindowQueryResult<
  TData = AgentsServiceRetrieveAgentContextWindowDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceRetrieveAgentContextWindowKey =
  'AgentsServiceRetrieveAgentContextWindow';
export const UseAgentsServiceRetrieveAgentContextWindowKeyFn = (
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceRetrieveAgentContextWindowKey,
  ...(queryKey ?? [{ agentId, userId }]),
];
export type AgentsServiceRetrieveAgentDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.retrieveAgent>
>;
export type AgentsServiceRetrieveAgentQueryResult<
  TData = AgentsServiceRetrieveAgentDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceRetrieveAgentKey = 'AgentsServiceRetrieveAgent';
export const UseAgentsServiceRetrieveAgentKeyFn = (
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [useAgentsServiceRetrieveAgentKey, ...(queryKey ?? [{ agentId, userId }])];
export type AgentsServiceListAgentToolsDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentTools>
>;
export type AgentsServiceListAgentToolsQueryResult<
  TData = AgentsServiceListAgentToolsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentToolsKey = 'AgentsServiceListAgentTools';
export const UseAgentsServiceListAgentToolsKeyFn = (
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentToolsKey,
  ...(queryKey ?? [{ agentId, userId }]),
];
export type AgentsServiceListAgentSourcesDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentSources>
>;
export type AgentsServiceListAgentSourcesQueryResult<
  TData = AgentsServiceListAgentSourcesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentSourcesKey =
  'AgentsServiceListAgentSources';
export const UseAgentsServiceListAgentSourcesKeyFn = (
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentSourcesKey,
  ...(queryKey ?? [{ agentId, userId }]),
];
export type AgentsServiceRetrieveAgentMemoryDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.retrieveAgentMemory>
>;
export type AgentsServiceRetrieveAgentMemoryQueryResult<
  TData = AgentsServiceRetrieveAgentMemoryDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceRetrieveAgentMemoryKey =
  'AgentsServiceRetrieveAgentMemory';
export const UseAgentsServiceRetrieveAgentMemoryKeyFn = (
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceRetrieveAgentMemoryKey,
  ...(queryKey ?? [{ agentId, userId }]),
];
export type AgentsServiceRetrieveCoreMemoryBlockDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.retrieveCoreMemoryBlock>
>;
export type AgentsServiceRetrieveCoreMemoryBlockQueryResult<
  TData = AgentsServiceRetrieveCoreMemoryBlockDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceRetrieveCoreMemoryBlockKey =
  'AgentsServiceRetrieveCoreMemoryBlock';
export const UseAgentsServiceRetrieveCoreMemoryBlockKeyFn = (
  {
    agentId,
    blockLabel,
    userId,
  }: {
    agentId: string;
    blockLabel: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceRetrieveCoreMemoryBlockKey,
  ...(queryKey ?? [{ agentId, blockLabel, userId }]),
];
export type AgentsServiceListCoreMemoryBlocksDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listCoreMemoryBlocks>
>;
export type AgentsServiceListCoreMemoryBlocksQueryResult<
  TData = AgentsServiceListCoreMemoryBlocksDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListCoreMemoryBlocksKey =
  'AgentsServiceListCoreMemoryBlocks';
export const UseAgentsServiceListCoreMemoryBlocksKeyFn = (
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListCoreMemoryBlocksKey,
  ...(queryKey ?? [{ agentId, userId }]),
];
export type AgentsServiceListPassagesDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listPassages>
>;
export type AgentsServiceListPassagesQueryResult<
  TData = AgentsServiceListPassagesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListPassagesKey = 'AgentsServiceListPassages';
export const UseAgentsServiceListPassagesKeyFn = (
  {
    after,
    agentId,
    ascending,
    before,
    limit,
    search,
    userId,
  }: {
    after?: string;
    agentId: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    search?: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListPassagesKey,
  ...(queryKey ?? [
    { after, agentId, ascending, before, limit, search, userId },
  ]),
];
export type AgentsServiceListMessagesDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listMessages>
>;
export type AgentsServiceListMessagesQueryResult<
  TData = AgentsServiceListMessagesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListMessagesKey = 'AgentsServiceListMessages';
export const UseAgentsServiceListMessagesKeyFn = (
  {
    after,
    agentId,
    assistantMessageToolKwarg,
    assistantMessageToolName,
    before,
    groupId,
    limit,
    useAssistantMessage,
    userId,
  }: {
    after?: string;
    agentId: string;
    assistantMessageToolKwarg?: string;
    assistantMessageToolName?: string;
    before?: string;
    groupId?: string;
    limit?: number;
    useAssistantMessage?: boolean;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListMessagesKey,
  ...(queryKey ?? [
    {
      after,
      agentId,
      assistantMessageToolKwarg,
      assistantMessageToolName,
      before,
      groupId,
      limit,
      useAssistantMessage,
      userId,
    },
  ]),
];
export type GroupsServiceListGroupsDefaultResponse = Awaited<
  ReturnType<typeof GroupsService.listGroups>
>;
export type GroupsServiceListGroupsQueryResult<
  TData = GroupsServiceListGroupsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGroupsServiceListGroupsKey = 'GroupsServiceListGroups';
export const UseGroupsServiceListGroupsKeyFn = (
  {
    after,
    before,
    limit,
    managerType,
    projectId,
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    managerType?: ManagerType;
    projectId?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useGroupsServiceListGroupsKey,
  ...(queryKey ?? [{ after, before, limit, managerType, projectId, userId }]),
];
export type GroupsServiceRetrieveGroupDefaultResponse = Awaited<
  ReturnType<typeof GroupsService.retrieveGroup>
>;
export type GroupsServiceRetrieveGroupQueryResult<
  TData = GroupsServiceRetrieveGroupDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGroupsServiceRetrieveGroupKey = 'GroupsServiceRetrieveGroup';
export const UseGroupsServiceRetrieveGroupKeyFn = (
  {
    groupId,
    userId,
  }: {
    groupId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [useGroupsServiceRetrieveGroupKey, ...(queryKey ?? [{ groupId, userId }])];
export type GroupsServiceListGroupMessagesDefaultResponse = Awaited<
  ReturnType<typeof GroupsService.listGroupMessages>
>;
export type GroupsServiceListGroupMessagesQueryResult<
  TData = GroupsServiceListGroupMessagesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGroupsServiceListGroupMessagesKey =
  'GroupsServiceListGroupMessages';
export const UseGroupsServiceListGroupMessagesKeyFn = (
  {
    after,
    assistantMessageToolKwarg,
    assistantMessageToolName,
    before,
    groupId,
    limit,
    useAssistantMessage,
    userId,
  }: {
    after?: string;
    assistantMessageToolKwarg?: string;
    assistantMessageToolName?: string;
    before?: string;
    groupId: string;
    limit?: number;
    useAssistantMessage?: boolean;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useGroupsServiceListGroupMessagesKey,
  ...(queryKey ?? [
    {
      after,
      assistantMessageToolKwarg,
      assistantMessageToolName,
      before,
      groupId,
      limit,
      useAssistantMessage,
      userId,
    },
  ]),
];
export type IdentitiesServiceListIdentitiesDefaultResponse = Awaited<
  ReturnType<typeof IdentitiesService.listIdentities>
>;
export type IdentitiesServiceListIdentitiesQueryResult<
  TData = IdentitiesServiceListIdentitiesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useIdentitiesServiceListIdentitiesKey =
  'IdentitiesServiceListIdentities';
export const UseIdentitiesServiceListIdentitiesKeyFn = (
  {
    after,
    before,
    identifierKey,
    identityType,
    limit,
    name,
    projectId,
    userId,
  }: {
    after?: string;
    before?: string;
    identifierKey?: string;
    identityType?: IdentityType;
    limit?: number;
    name?: string;
    projectId?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useIdentitiesServiceListIdentitiesKey,
  ...(queryKey ?? [
    {
      after,
      before,
      identifierKey,
      identityType,
      limit,
      name,
      projectId,
      userId,
    },
  ]),
];
export type IdentitiesServiceRetrieveIdentityDefaultResponse = Awaited<
  ReturnType<typeof IdentitiesService.retrieveIdentity>
>;
export type IdentitiesServiceRetrieveIdentityQueryResult<
  TData = IdentitiesServiceRetrieveIdentityDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useIdentitiesServiceRetrieveIdentityKey =
  'IdentitiesServiceRetrieveIdentity';
export const UseIdentitiesServiceRetrieveIdentityKeyFn = (
  {
    identityId,
    userId,
  }: {
    identityId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useIdentitiesServiceRetrieveIdentityKey,
  ...(queryKey ?? [{ identityId, userId }]),
];
export type ModelsServiceListModelsDefaultResponse = Awaited<
  ReturnType<typeof ModelsService.listModels>
>;
export type ModelsServiceListModelsQueryResult<
  TData = ModelsServiceListModelsDefaultResponse,
  TError = unknown,
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
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useModelsServiceListEmbeddingModelsKey =
  'ModelsServiceListEmbeddingModels';
export const UseModelsServiceListEmbeddingModelsKeyFn = (
  queryKey?: Array<unknown>,
) => [useModelsServiceListEmbeddingModelsKey, ...(queryKey ?? [])];
export type LlmsServiceListModelsDefaultResponse = Awaited<
  ReturnType<typeof LlmsService.listModels>
>;
export type LlmsServiceListModelsQueryResult<
  TData = LlmsServiceListModelsDefaultResponse,
  TError = unknown,
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
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useLlmsServiceListEmbeddingModelsKey =
  'LlmsServiceListEmbeddingModels';
export const UseLlmsServiceListEmbeddingModelsKeyFn = (
  queryKey?: Array<unknown>,
) => [useLlmsServiceListEmbeddingModelsKey, ...(queryKey ?? [])];
export type BlocksServiceListBlocksDefaultResponse = Awaited<
  ReturnType<typeof BlocksService.listBlocks>
>;
export type BlocksServiceListBlocksQueryResult<
  TData = BlocksServiceListBlocksDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useBlocksServiceListBlocksKey = 'BlocksServiceListBlocks';
export const UseBlocksServiceListBlocksKeyFn = (
  {
    identifierKeys,
    identityId,
    label,
    name,
    templatesOnly,
    userId,
  }: {
    identifierKeys?: string[];
    identityId?: string;
    label?: string;
    name?: string;
    templatesOnly?: boolean;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useBlocksServiceListBlocksKey,
  ...(queryKey ?? [
    { identifierKeys, identityId, label, name, templatesOnly, userId },
  ]),
];
export type BlocksServiceRetrieveBlockDefaultResponse = Awaited<
  ReturnType<typeof BlocksService.retrieveBlock>
>;
export type BlocksServiceRetrieveBlockQueryResult<
  TData = BlocksServiceRetrieveBlockDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useBlocksServiceRetrieveBlockKey = 'BlocksServiceRetrieveBlock';
export const UseBlocksServiceRetrieveBlockKeyFn = (
  {
    blockId,
    userId,
  }: {
    blockId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [useBlocksServiceRetrieveBlockKey, ...(queryKey ?? [{ blockId, userId }])];
export type BlocksServiceListAgentsForBlockDefaultResponse = Awaited<
  ReturnType<typeof BlocksService.listAgentsForBlock>
>;
export type BlocksServiceListAgentsForBlockQueryResult<
  TData = BlocksServiceListAgentsForBlockDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useBlocksServiceListAgentsForBlockKey =
  'BlocksServiceListAgentsForBlock';
export const UseBlocksServiceListAgentsForBlockKeyFn = (
  {
    blockId,
    userId,
  }: {
    blockId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useBlocksServiceListAgentsForBlockKey,
  ...(queryKey ?? [{ blockId, userId }]),
];
export type JobsServiceListJobsDefaultResponse = Awaited<
  ReturnType<typeof JobsService.listJobs>
>;
export type JobsServiceListJobsQueryResult<
  TData = JobsServiceListJobsDefaultResponse,
  TError = unknown,
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
  queryKey?: Array<unknown>,
) => [useJobsServiceListJobsKey, ...(queryKey ?? [{ sourceId, userId }])];
export type JobsServiceListActiveJobsDefaultResponse = Awaited<
  ReturnType<typeof JobsService.listActiveJobs>
>;
export type JobsServiceListActiveJobsQueryResult<
  TData = JobsServiceListActiveJobsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useJobsServiceListActiveJobsKey = 'JobsServiceListActiveJobs';
export const UseJobsServiceListActiveJobsKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useJobsServiceListActiveJobsKey, ...(queryKey ?? [{ userId }])];
export type JobsServiceRetrieveJobDefaultResponse = Awaited<
  ReturnType<typeof JobsService.retrieveJob>
>;
export type JobsServiceRetrieveJobQueryResult<
  TData = JobsServiceRetrieveJobDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useJobsServiceRetrieveJobKey = 'JobsServiceRetrieveJob';
export const UseJobsServiceRetrieveJobKeyFn = (
  {
    jobId,
    userId,
  }: {
    jobId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [useJobsServiceRetrieveJobKey, ...(queryKey ?? [{ jobId, userId }])];
export type HealthServiceHealthCheckDefaultResponse = Awaited<
  ReturnType<typeof HealthService.healthCheck>
>;
export type HealthServiceHealthCheckQueryResult<
  TData = HealthServiceHealthCheckDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useHealthServiceHealthCheckKey = 'HealthServiceHealthCheck';
export const UseHealthServiceHealthCheckKeyFn = (queryKey?: Array<unknown>) => [
  useHealthServiceHealthCheckKey,
  ...(queryKey ?? []),
];
export type SandboxConfigServiceListSandboxConfigsV1SandboxConfigGetDefaultResponse =
  Awaited<
    ReturnType<typeof SandboxConfigService.listSandboxConfigsV1SandboxConfigGet>
  >;
export type SandboxConfigServiceListSandboxConfigsV1SandboxConfigGetQueryResult<
  TData = SandboxConfigServiceListSandboxConfigsV1SandboxConfigGetDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKey =
  'SandboxConfigServiceListSandboxConfigsV1SandboxConfigGet';
export const UseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKeyFn =
  (
    {
      after,
      limit,
      sandboxType,
      userId,
    }: {
      after?: string;
      limit?: number;
      sandboxType?: SandboxType;
      userId?: string;
    } = {},
    queryKey?: Array<unknown>,
  ) => [
    useSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKey,
    ...(queryKey ?? [{ after, limit, sandboxType, userId }]),
  ];
export type SandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetDefaultResponse =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet
    >
  >;
export type SandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetQueryResult<
  TData = SandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKey =
  'SandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet';
export const UseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKeyFn =
  (
    {
      after,
      limit,
      sandboxConfigId,
      userId,
    }: {
      after?: string;
      limit?: number;
      sandboxConfigId: string;
      userId?: string;
    },
    queryKey?: Array<unknown>,
  ) => [
    useSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKey,
    ...(queryKey ?? [{ after, limit, sandboxConfigId, userId }]),
  ];
export type ProvidersServiceListProvidersDefaultResponse = Awaited<
  ReturnType<typeof ProvidersService.listProviders>
>;
export type ProvidersServiceListProvidersQueryResult<
  TData = ProvidersServiceListProvidersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useProvidersServiceListProvidersKey =
  'ProvidersServiceListProviders';
export const UseProvidersServiceListProvidersKeyFn = (
  {
    after,
    limit,
    userId,
  }: {
    after?: string;
    limit?: number;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useProvidersServiceListProvidersKey,
  ...(queryKey ?? [{ after, limit, userId }]),
];
export type RunsServiceListRunsDefaultResponse = Awaited<
  ReturnType<typeof RunsService.listRuns>
>;
export type RunsServiceListRunsQueryResult<
  TData = RunsServiceListRunsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useRunsServiceListRunsKey = 'RunsServiceListRuns';
export const UseRunsServiceListRunsKeyFn = (
  {
    agentIds,
    userId,
  }: {
    agentIds?: string[];
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useRunsServiceListRunsKey, ...(queryKey ?? [{ agentIds, userId }])];
export type RunsServiceListActiveRunsDefaultResponse = Awaited<
  ReturnType<typeof RunsService.listActiveRuns>
>;
export type RunsServiceListActiveRunsQueryResult<
  TData = RunsServiceListActiveRunsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useRunsServiceListActiveRunsKey = 'RunsServiceListActiveRuns';
export const UseRunsServiceListActiveRunsKeyFn = (
  {
    agentIds,
    userId,
  }: {
    agentIds?: string[];
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useRunsServiceListActiveRunsKey, ...(queryKey ?? [{ agentIds, userId }])];
export type RunsServiceRetrieveRunDefaultResponse = Awaited<
  ReturnType<typeof RunsService.retrieveRun>
>;
export type RunsServiceRetrieveRunQueryResult<
  TData = RunsServiceRetrieveRunDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useRunsServiceRetrieveRunKey = 'RunsServiceRetrieveRun';
export const UseRunsServiceRetrieveRunKeyFn = (
  {
    runId,
    userId,
  }: {
    runId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [useRunsServiceRetrieveRunKey, ...(queryKey ?? [{ runId, userId }])];
export type RunsServiceListRunMessagesDefaultResponse = Awaited<
  ReturnType<typeof RunsService.listRunMessages>
>;
export type RunsServiceListRunMessagesQueryResult<
  TData = RunsServiceListRunMessagesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useRunsServiceListRunMessagesKey = 'RunsServiceListRunMessages';
export const UseRunsServiceListRunMessagesKeyFn = (
  {
    after,
    before,
    limit,
    order,
    role,
    runId,
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: string;
    role?: MessageRole;
    runId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useRunsServiceListRunMessagesKey,
  ...(queryKey ?? [{ after, before, limit, order, role, runId, userId }]),
];
export type RunsServiceRetrieveRunUsageDefaultResponse = Awaited<
  ReturnType<typeof RunsService.retrieveRunUsage>
>;
export type RunsServiceRetrieveRunUsageQueryResult<
  TData = RunsServiceRetrieveRunUsageDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useRunsServiceRetrieveRunUsageKey = 'RunsServiceRetrieveRunUsage';
export const UseRunsServiceRetrieveRunUsageKeyFn = (
  {
    runId,
    userId,
  }: {
    runId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [useRunsServiceRetrieveRunUsageKey, ...(queryKey ?? [{ runId, userId }])];
export type RunsServiceListRunStepsDefaultResponse = Awaited<
  ReturnType<typeof RunsService.listRunSteps>
>;
export type RunsServiceListRunStepsQueryResult<
  TData = RunsServiceListRunStepsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useRunsServiceListRunStepsKey = 'RunsServiceListRunSteps';
export const UseRunsServiceListRunStepsKeyFn = (
  {
    after,
    before,
    limit,
    order,
    runId,
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: string;
    runId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useRunsServiceListRunStepsKey,
  ...(queryKey ?? [{ after, before, limit, order, runId, userId }]),
];
export type StepsServiceListStepsDefaultResponse = Awaited<
  ReturnType<typeof StepsService.listSteps>
>;
export type StepsServiceListStepsQueryResult<
  TData = StepsServiceListStepsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useStepsServiceListStepsKey = 'StepsServiceListSteps';
export const UseStepsServiceListStepsKeyFn = (
  {
    after,
    agentId,
    before,
    endDate,
    limit,
    model,
    order,
    startDate,
    userId,
  }: {
    after?: string;
    agentId?: string;
    before?: string;
    endDate?: string;
    limit?: number;
    model?: string;
    order?: string;
    startDate?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useStepsServiceListStepsKey,
  ...(queryKey ?? [
    { after, agentId, before, endDate, limit, model, order, startDate, userId },
  ]),
];
export type StepsServiceRetrieveStepDefaultResponse = Awaited<
  ReturnType<typeof StepsService.retrieveStep>
>;
export type StepsServiceRetrieveStepQueryResult<
  TData = StepsServiceRetrieveStepDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useStepsServiceRetrieveStepKey = 'StepsServiceRetrieveStep';
export const UseStepsServiceRetrieveStepKeyFn = (
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [useStepsServiceRetrieveStepKey, ...(queryKey ?? [{ stepId, userId }])];
export type TagServiceListTagsDefaultResponse = Awaited<
  ReturnType<typeof TagService.listTags>
>;
export type TagServiceListTagsQueryResult<
  TData = TagServiceListTagsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useTagServiceListTagsKey = 'TagServiceListTags';
export const UseTagServiceListTagsKeyFn = (
  {
    after,
    limit,
    queryText,
    userId,
  }: {
    after?: string;
    limit?: number;
    queryText?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useTagServiceListTagsKey,
  ...(queryKey ?? [{ after, limit, queryText, userId }]),
];
export type AdminServiceListTagsDefaultResponse = Awaited<
  ReturnType<typeof AdminService.listTags>
>;
export type AdminServiceListTagsQueryResult<
  TData = AdminServiceListTagsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAdminServiceListTagsKey = 'AdminServiceListTags';
export const UseAdminServiceListTagsKeyFn = (
  {
    after,
    limit,
    queryText,
    userId,
  }: {
    after?: string;
    limit?: number;
    queryText?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useAdminServiceListTagsKey,
  ...(queryKey ?? [{ after, limit, queryText, userId }]),
];
export type AdminServiceListUsersDefaultResponse = Awaited<
  ReturnType<typeof AdminService.listUsers>
>;
export type AdminServiceListUsersQueryResult<
  TData = AdminServiceListUsersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAdminServiceListUsersKey = 'AdminServiceListUsers';
export const UseAdminServiceListUsersKeyFn = (
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>,
) => [useAdminServiceListUsersKey, ...(queryKey ?? [{ after, limit }])];
export type AdminServiceListOrgsDefaultResponse = Awaited<
  ReturnType<typeof AdminService.listOrgs>
>;
export type AdminServiceListOrgsQueryResult<
  TData = AdminServiceListOrgsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAdminServiceListOrgsKey = 'AdminServiceListOrgs';
export const UseAdminServiceListOrgsKeyFn = (
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>,
) => [useAdminServiceListOrgsKey, ...(queryKey ?? [{ after, limit }])];
export type UsersServiceListUsersDefaultResponse = Awaited<
  ReturnType<typeof UsersService.listUsers>
>;
export type UsersServiceListUsersQueryResult<
  TData = UsersServiceListUsersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useUsersServiceListUsersKey = 'UsersServiceListUsers';
export const UseUsersServiceListUsersKeyFn = (
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>,
) => [useUsersServiceListUsersKey, ...(queryKey ?? [{ after, limit }])];
export type OrganizationServiceListOrgsDefaultResponse = Awaited<
  ReturnType<typeof OrganizationService.listOrgs>
>;
export type OrganizationServiceListOrgsQueryResult<
  TData = OrganizationServiceListOrgsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useOrganizationServiceListOrgsKey = 'OrganizationServiceListOrgs';
export const UseOrganizationServiceListOrgsKeyFn = (
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>,
) => [useOrganizationServiceListOrgsKey, ...(queryKey ?? [{ after, limit }])];
export type ToolsServiceCreateToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.createTool>
>;
export type ToolsServiceAddBaseToolsMutationResult = Awaited<
  ReturnType<typeof ToolsService.addBaseTools>
>;
export type ToolsServiceRunToolFromSourceMutationResult = Awaited<
  ReturnType<typeof ToolsService.runToolFromSource>
>;
export type ToolsServiceAddComposioToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.addComposioTool>
>;
export type ToolsServiceAddMcpToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.addMcpTool>
>;
export type SourcesServiceCreateSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.createSource>
>;
export type SourcesServiceUploadFileToSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.uploadFileToSource>
>;
export type AgentsServiceCreateAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.createAgent>
>;
export type AgentsServiceImportAgentSerializedMutationResult = Awaited<
  ReturnType<typeof AgentsService.importAgentSerialized>
>;
export type AgentsServiceCreatePassageMutationResult = Awaited<
  ReturnType<typeof AgentsService.createPassage>
>;
export type AgentsServiceSendMessageMutationResult = Awaited<
  ReturnType<typeof AgentsService.sendMessage>
>;
export type AgentsServiceCreateAgentMessageStreamMutationResult = Awaited<
  ReturnType<typeof AgentsService.createAgentMessageStream>
>;
export type AgentsServiceCreateAgentMessageAsyncMutationResult = Awaited<
  ReturnType<typeof AgentsService.createAgentMessageAsync>
>;
export type GroupsServiceCreateGroupMutationResult = Awaited<
  ReturnType<typeof GroupsService.createGroup>
>;
export type GroupsServiceSendGroupMessageMutationResult = Awaited<
  ReturnType<typeof GroupsService.sendGroupMessage>
>;
export type GroupsServiceSendGroupMessageStreamingMutationResult = Awaited<
  ReturnType<typeof GroupsService.sendGroupMessageStreaming>
>;
export type IdentitiesServiceCreateIdentityMutationResult = Awaited<
  ReturnType<typeof IdentitiesService.createIdentity>
>;
export type BlocksServiceCreateBlockMutationResult = Awaited<
  ReturnType<typeof BlocksService.createBlock>
>;
export type SandboxConfigServiceCreateSandboxConfigV1SandboxConfigPostMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.createSandboxConfigV1SandboxConfigPost
    >
  >;
export type SandboxConfigServiceCreateDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPostMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.createDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPost
    >
  >;
export type SandboxConfigServiceCreateDefaultLocalSandboxConfigV1SandboxConfigLocalDefaultPostMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.createDefaultLocalSandboxConfigV1SandboxConfigLocalDefaultPost
    >
  >;
export type SandboxConfigServiceCreateCustomLocalSandboxConfigV1SandboxConfigLocalPostMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.createCustomLocalSandboxConfigV1SandboxConfigLocalPost
    >
  >;
export type SandboxConfigServiceForceRecreateLocalSandboxVenvV1SandboxConfigLocalRecreateVenvPostMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.forceRecreateLocalSandboxVenvV1SandboxConfigLocalRecreateVenvPost
    >
  >;
export type SandboxConfigServiceCreateSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePostMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.createSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePost
    >
  >;
export type ProvidersServiceCreateProviderMutationResult = Awaited<
  ReturnType<typeof ProvidersService.createProvider>
>;
export type AdminServiceCreateUserMutationResult = Awaited<
  ReturnType<typeof AdminService.createUser>
>;
export type AdminServiceCreateOrganizationMutationResult = Awaited<
  ReturnType<typeof AdminService.createOrganization>
>;
export type VoiceServiceCreateVoiceChatCompletionsMutationResult = Awaited<
  ReturnType<typeof VoiceService.createVoiceChatCompletions>
>;
export type UsersServiceCreateUserMutationResult = Awaited<
  ReturnType<typeof UsersService.createUser>
>;
export type OrganizationServiceCreateOrganizationMutationResult = Awaited<
  ReturnType<typeof OrganizationService.createOrganization>
>;
export type AuthServiceAuthenticateUserV1AuthPostMutationResult = Awaited<
  ReturnType<typeof AuthService.authenticateUserV1AuthPost>
>;
export type ToolsServiceUpsertToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.upsertTool>
>;
export type ToolsServiceAddMcpServerMutationResult = Awaited<
  ReturnType<typeof ToolsService.addMcpServer>
>;
export type IdentitiesServiceUpsertIdentityMutationResult = Awaited<
  ReturnType<typeof IdentitiesService.upsertIdentity>
>;
export type IdentitiesServiceUpsertIdentityPropertiesMutationResult = Awaited<
  ReturnType<typeof IdentitiesService.upsertIdentityProperties>
>;
export type AdminServiceUpdateUserMutationResult = Awaited<
  ReturnType<typeof AdminService.updateUser>
>;
export type UsersServiceUpdateUserMutationResult = Awaited<
  ReturnType<typeof UsersService.updateUser>
>;
export type ToolsServiceModifyToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.modifyTool>
>;
export type SourcesServiceModifySourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.modifySource>
>;
export type AgentsServiceModifyAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.modifyAgent>
>;
export type AgentsServiceAttachToolMutationResult = Awaited<
  ReturnType<typeof AgentsService.attachTool>
>;
export type AgentsServiceDetachToolMutationResult = Awaited<
  ReturnType<typeof AgentsService.detachTool>
>;
export type AgentsServiceAttachSourceToAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.attachSourceToAgent>
>;
export type AgentsServiceDetachSourceFromAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.detachSourceFromAgent>
>;
export type AgentsServiceModifyCoreMemoryBlockMutationResult = Awaited<
  ReturnType<typeof AgentsService.modifyCoreMemoryBlock>
>;
export type AgentsServiceAttachCoreMemoryBlockMutationResult = Awaited<
  ReturnType<typeof AgentsService.attachCoreMemoryBlock>
>;
export type AgentsServiceDetachCoreMemoryBlockMutationResult = Awaited<
  ReturnType<typeof AgentsService.detachCoreMemoryBlock>
>;
export type AgentsServiceModifyPassageMutationResult = Awaited<
  ReturnType<typeof AgentsService.modifyPassage>
>;
export type AgentsServiceModifyMessageMutationResult = Awaited<
  ReturnType<typeof AgentsService.modifyMessage>
>;
export type AgentsServiceResetMessagesMutationResult = Awaited<
  ReturnType<typeof AgentsService.resetMessages>
>;
export type GroupsServiceModifyGroupMutationResult = Awaited<
  ReturnType<typeof GroupsService.modifyGroup>
>;
export type GroupsServiceModifyGroupMessageMutationResult = Awaited<
  ReturnType<typeof GroupsService.modifyGroupMessage>
>;
export type GroupsServiceResetGroupMessagesMutationResult = Awaited<
  ReturnType<typeof GroupsService.resetGroupMessages>
>;
export type IdentitiesServiceUpdateIdentityMutationResult = Awaited<
  ReturnType<typeof IdentitiesService.updateIdentity>
>;
export type BlocksServiceModifyBlockMutationResult = Awaited<
  ReturnType<typeof BlocksService.modifyBlock>
>;
export type SandboxConfigServiceUpdateSandboxConfigV1SandboxConfigSandboxConfigIdPatchMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.updateSandboxConfigV1SandboxConfigSandboxConfigIdPatch
    >
  >;
export type SandboxConfigServiceUpdateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatchMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.updateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatch
    >
  >;
export type ProvidersServiceModifyProviderMutationResult = Awaited<
  ReturnType<typeof ProvidersService.modifyProvider>
>;
export type StepsServiceUpdateStepTransactionIdMutationResult = Awaited<
  ReturnType<typeof StepsService.updateStepTransactionId>
>;
export type AdminServiceUpdateOrganizationMutationResult = Awaited<
  ReturnType<typeof AdminService.updateOrganization>
>;
export type OrganizationServiceUpdateOrganizationMutationResult = Awaited<
  ReturnType<typeof OrganizationService.updateOrganization>
>;
export type ToolsServiceDeleteToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.deleteTool>
>;
export type ToolsServiceDeleteMcpServerMutationResult = Awaited<
  ReturnType<typeof ToolsService.deleteMcpServer>
>;
export type SourcesServiceDeleteSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.deleteSource>
>;
export type SourcesServiceDeleteFileFromSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.deleteFileFromSource>
>;
export type AgentsServiceDeleteAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.deleteAgent>
>;
export type AgentsServiceDeletePassageMutationResult = Awaited<
  ReturnType<typeof AgentsService.deletePassage>
>;
export type GroupsServiceDeleteGroupMutationResult = Awaited<
  ReturnType<typeof GroupsService.deleteGroup>
>;
export type IdentitiesServiceDeleteIdentityMutationResult = Awaited<
  ReturnType<typeof IdentitiesService.deleteIdentity>
>;
export type BlocksServiceDeleteBlockMutationResult = Awaited<
  ReturnType<typeof BlocksService.deleteBlock>
>;
export type JobsServiceDeleteJobMutationResult = Awaited<
  ReturnType<typeof JobsService.deleteJob>
>;
export type SandboxConfigServiceDeleteSandboxConfigV1SandboxConfigSandboxConfigIdDeleteMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.deleteSandboxConfigV1SandboxConfigSandboxConfigIdDelete
    >
  >;
export type SandboxConfigServiceDeleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDeleteMutationResult =
  Awaited<
    ReturnType<
      typeof SandboxConfigService.deleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDelete
    >
  >;
export type ProvidersServiceDeleteProviderMutationResult = Awaited<
  ReturnType<typeof ProvidersService.deleteProvider>
>;
export type RunsServiceDeleteRunMutationResult = Awaited<
  ReturnType<typeof RunsService.deleteRun>
>;
export type AdminServiceDeleteUserMutationResult = Awaited<
  ReturnType<typeof AdminService.deleteUser>
>;
export type AdminServiceDeleteOrganizationByIdMutationResult = Awaited<
  ReturnType<typeof AdminService.deleteOrganizationById>
>;
export type UsersServiceDeleteUserMutationResult = Awaited<
  ReturnType<typeof UsersService.deleteUser>
>;
export type OrganizationServiceDeleteOrganizationByIdMutationResult = Awaited<
  ReturnType<typeof OrganizationService.deleteOrganizationById>
>;

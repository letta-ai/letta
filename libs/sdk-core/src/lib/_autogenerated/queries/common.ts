// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryResult } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
  AuthService,
  BlocksService,
  EmbeddingsService,
  FoldersService,
  GroupsService,
  HealthService,
  IdentitiesService,
  JobsService,
  LlmsService,
  MessagesService,
  ModelsService,
  OrganizationService,
  ProvidersService,
  RunsService,
  SandboxConfigService,
  SourcesService,
  StepsService,
  TagService,
  TelemetryService,
  ToolsService,
  UsersService,
  VoiceService,
} from '../requests/services.gen';
import {
  Body_export_agent_serialized,
  IdentityType,
  ManagerType,
  MessageRole,
  ProviderCategory,
  ProviderType,
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
export type ToolsServiceCountToolsDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.countTools>
>;
export type ToolsServiceCountToolsQueryResult<
  TData = ToolsServiceCountToolsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useToolsServiceCountToolsKey = 'ToolsServiceCountTools';
export const UseToolsServiceCountToolsKeyFn = (
  {
    includeBaseTools,
    userId,
  }: {
    includeBaseTools?: boolean;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useToolsServiceCountToolsKey,
  ...(queryKey ?? [{ includeBaseTools, userId }]),
];
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
export type ToolsServiceMcpOauthCallbackDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.mcpOauthCallback>
>;
export type ToolsServiceMcpOauthCallbackQueryResult<
  TData = ToolsServiceMcpOauthCallbackDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useToolsServiceMcpOauthCallbackKey =
  'ToolsServiceMcpOauthCallback';
export const UseToolsServiceMcpOauthCallbackKeyFn = (
  {
    code,
    error,
    errorDescription,
    sessionId,
    state,
  }: {
    code?: string;
    error?: string;
    errorDescription?: string;
    sessionId: string;
    state?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useToolsServiceMcpOauthCallbackKey,
  ...(queryKey ?? [{ code, error, errorDescription, sessionId, state }]),
];
export type SourcesServiceCountSourcesDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.countSources>
>;
export type SourcesServiceCountSourcesQueryResult<
  TData = SourcesServiceCountSourcesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSourcesServiceCountSourcesKey = 'SourcesServiceCountSources';
export const UseSourcesServiceCountSourcesKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useSourcesServiceCountSourcesKey, ...(queryKey ?? [{ userId }])];
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
export type SourcesServiceGetSourcesMetadataDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.getSourcesMetadata>
>;
export type SourcesServiceGetSourcesMetadataQueryResult<
  TData = SourcesServiceGetSourcesMetadataDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSourcesServiceGetSourcesMetadataKey =
  'SourcesServiceGetSourcesMetadata';
export const UseSourcesServiceGetSourcesMetadataKeyFn = (
  {
    includeDetailedPerSourceMetadata,
    userId,
  }: {
    includeDetailedPerSourceMetadata?: boolean;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceGetSourcesMetadataKey,
  ...(queryKey ?? [{ includeDetailedPerSourceMetadata, userId }]),
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
export type SourcesServiceGetAgentsForSourceDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.getAgentsForSource>
>;
export type SourcesServiceGetAgentsForSourceQueryResult<
  TData = SourcesServiceGetAgentsForSourceDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSourcesServiceGetAgentsForSourceKey =
  'SourcesServiceGetAgentsForSource';
export const UseSourcesServiceGetAgentsForSourceKeyFn = (
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceGetAgentsForSourceKey,
  ...(queryKey ?? [{ sourceId, userId }]),
];
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
    after,
    before,
    limit,
    sourceId,
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceListSourcePassagesKey,
  ...(queryKey ?? [{ after, before, limit, sourceId, userId }]),
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
    checkStatusUpdates,
    includeContent,
    limit,
    sourceId,
    userId,
  }: {
    after?: string;
    checkStatusUpdates?: boolean;
    includeContent?: boolean;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceListSourceFilesKey,
  ...(queryKey ?? [
    { after, checkStatusUpdates, includeContent, limit, sourceId, userId },
  ]),
];
export type SourcesServiceGetFileMetadataDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.getFileMetadata>
>;
export type SourcesServiceGetFileMetadataQueryResult<
  TData = SourcesServiceGetFileMetadataDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useSourcesServiceGetFileMetadataKey =
  'SourcesServiceGetFileMetadata';
export const UseSourcesServiceGetFileMetadataKeyFn = (
  {
    fileId,
    includeContent,
    sourceId,
    userId,
  }: {
    fileId: string;
    includeContent?: boolean;
    sourceId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceGetFileMetadataKey,
  ...(queryKey ?? [{ fileId, includeContent, sourceId, userId }]),
];
export type FoldersServiceCountFoldersDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.countFolders>
>;
export type FoldersServiceCountFoldersQueryResult<
  TData = FoldersServiceCountFoldersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceCountFoldersKey = 'FoldersServiceCountFolders';
export const UseFoldersServiceCountFoldersKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useFoldersServiceCountFoldersKey, ...(queryKey ?? [{ userId }])];
export type FoldersServiceRetrieveFolderDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.retrieveFolder>
>;
export type FoldersServiceRetrieveFolderQueryResult<
  TData = FoldersServiceRetrieveFolderDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceRetrieveFolderKey =
  'FoldersServiceRetrieveFolder';
export const UseFoldersServiceRetrieveFolderKeyFn = (
  {
    folderId,
    userId,
  }: {
    folderId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceRetrieveFolderKey,
  ...(queryKey ?? [{ folderId, userId }]),
];
export type FoldersServiceGetFolderIdByNameDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.getFolderIdByName>
>;
export type FoldersServiceGetFolderIdByNameQueryResult<
  TData = FoldersServiceGetFolderIdByNameDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceGetFolderIdByNameKey =
  'FoldersServiceGetFolderIdByName';
export const UseFoldersServiceGetFolderIdByNameKeyFn = (
  {
    folderName,
    userId,
  }: {
    folderName: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceGetFolderIdByNameKey,
  ...(queryKey ?? [{ folderName, userId }]),
];
export type FoldersServiceGetFoldersMetadataDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.getFoldersMetadata>
>;
export type FoldersServiceGetFoldersMetadataQueryResult<
  TData = FoldersServiceGetFoldersMetadataDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceGetFoldersMetadataKey =
  'FoldersServiceGetFoldersMetadata';
export const UseFoldersServiceGetFoldersMetadataKeyFn = (
  {
    includeDetailedPerSourceMetadata,
    userId,
  }: {
    includeDetailedPerSourceMetadata?: boolean;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceGetFoldersMetadataKey,
  ...(queryKey ?? [{ includeDetailedPerSourceMetadata, userId }]),
];
export type FoldersServiceListFoldersDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.listFolders>
>;
export type FoldersServiceListFoldersQueryResult<
  TData = FoldersServiceListFoldersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceListFoldersKey = 'FoldersServiceListFolders';
export const UseFoldersServiceListFoldersKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useFoldersServiceListFoldersKey, ...(queryKey ?? [{ userId }])];
export type FoldersServiceGetAgentsForFolderDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.getAgentsForFolder>
>;
export type FoldersServiceGetAgentsForFolderQueryResult<
  TData = FoldersServiceGetAgentsForFolderDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceGetAgentsForFolderKey =
  'FoldersServiceGetAgentsForFolder';
export const UseFoldersServiceGetAgentsForFolderKeyFn = (
  {
    folderId,
    userId,
  }: {
    folderId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceGetAgentsForFolderKey,
  ...(queryKey ?? [{ folderId, userId }]),
];
export type FoldersServiceListFolderPassagesDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.listFolderPassages>
>;
export type FoldersServiceListFolderPassagesQueryResult<
  TData = FoldersServiceListFolderPassagesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceListFolderPassagesKey =
  'FoldersServiceListFolderPassages';
export const UseFoldersServiceListFolderPassagesKeyFn = (
  {
    after,
    before,
    folderId,
    limit,
    userId,
  }: {
    after?: string;
    before?: string;
    folderId: string;
    limit?: number;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceListFolderPassagesKey,
  ...(queryKey ?? [{ after, before, folderId, limit, userId }]),
];
export type FoldersServiceListFolderFilesDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.listFolderFiles>
>;
export type FoldersServiceListFolderFilesQueryResult<
  TData = FoldersServiceListFolderFilesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceListFolderFilesKey =
  'FoldersServiceListFolderFiles';
export const UseFoldersServiceListFolderFilesKeyFn = (
  {
    after,
    folderId,
    includeContent,
    limit,
    userId,
  }: {
    after?: string;
    folderId: string;
    includeContent?: boolean;
    limit?: number;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceListFolderFilesKey,
  ...(queryKey ?? [{ after, folderId, includeContent, limit, userId }]),
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
    sortBy,
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
    sortBy?: string;
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
      sortBy,
      tags,
      templateId,
      userId,
    },
  ]),
];
export type AgentsServiceCountAgentsDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.countAgents>
>;
export type AgentsServiceCountAgentsQueryResult<
  TData = AgentsServiceCountAgentsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceCountAgentsKey = 'AgentsServiceCountAgents';
export const UseAgentsServiceCountAgentsKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useAgentsServiceCountAgentsKey, ...(queryKey ?? [{ userId }])];
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
    maxSteps,
    requestBody,
    useLegacyFormat,
    userId,
  }: {
    agentId: string;
    maxSteps?: number;
    requestBody?: Body_export_agent_serialized;
    useLegacyFormat?: boolean;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceExportAgentSerializedKey,
  ...(queryKey ?? [
    { agentId, maxSteps, requestBody, useLegacyFormat, userId },
  ]),
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
    includeRelationships,
    userId,
  }: {
    agentId: string;
    includeRelationships?: string[];
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceRetrieveAgentKey,
  ...(queryKey ?? [{ agentId, includeRelationships, userId }]),
];
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
export type AgentsServiceListAgentFoldersDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentFolders>
>;
export type AgentsServiceListAgentFoldersQueryResult<
  TData = AgentsServiceListAgentFoldersDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentFoldersKey =
  'AgentsServiceListAgentFolders';
export const UseAgentsServiceListAgentFoldersKeyFn = (
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentFoldersKey,
  ...(queryKey ?? [{ agentId, userId }]),
];
export type AgentsServiceListAgentFilesDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentFiles>
>;
export type AgentsServiceListAgentFilesQueryResult<
  TData = AgentsServiceListAgentFilesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentFilesKey = 'AgentsServiceListAgentFiles';
export const UseAgentsServiceListAgentFilesKeyFn = (
  {
    agentId,
    cursor,
    isOpen,
    limit,
    userId,
  }: {
    agentId: string;
    cursor?: string;
    isOpen?: boolean;
    limit?: number;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentFilesKey,
  ...(queryKey ?? [{ agentId, cursor, isOpen, limit, userId }]),
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
    includeErr,
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
    includeErr?: boolean;
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
      includeErr,
      limit,
      useAssistantMessage,
      userId,
    },
  ]),
];
export type AgentsServiceListAgentGroupsDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentGroups>
>;
export type AgentsServiceListAgentGroupsQueryResult<
  TData = AgentsServiceListAgentGroupsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentGroupsKey =
  'AgentsServiceListAgentGroups';
export const UseAgentsServiceListAgentGroupsKeyFn = (
  {
    agentId,
    managerType,
    userId,
  }: {
    agentId: string;
    managerType?: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentGroupsKey,
  ...(queryKey ?? [{ agentId, managerType, userId }]),
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
export type GroupsServiceCountGroupsDefaultResponse = Awaited<
  ReturnType<typeof GroupsService.countGroups>
>;
export type GroupsServiceCountGroupsQueryResult<
  TData = GroupsServiceCountGroupsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useGroupsServiceCountGroupsKey = 'GroupsServiceCountGroups';
export const UseGroupsServiceCountGroupsKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useGroupsServiceCountGroupsKey, ...(queryKey ?? [{ userId }])];
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
export type IdentitiesServiceCountIdentitiesDefaultResponse = Awaited<
  ReturnType<typeof IdentitiesService.countIdentities>
>;
export type IdentitiesServiceCountIdentitiesQueryResult<
  TData = IdentitiesServiceCountIdentitiesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useIdentitiesServiceCountIdentitiesKey =
  'IdentitiesServiceCountIdentities';
export const UseIdentitiesServiceCountIdentitiesKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useIdentitiesServiceCountIdentitiesKey, ...(queryKey ?? [{ userId }])];
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
export const UseModelsServiceListModelsKeyFn = (
  {
    providerCategory,
    providerName,
    providerType,
    userId,
  }: {
    providerCategory?: ProviderCategory[];
    providerName?: string;
    providerType?: ProviderType;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useModelsServiceListModelsKey,
  ...(queryKey ?? [{ providerCategory, providerName, providerType, userId }]),
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
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useModelsServiceListEmbeddingModelsKey, ...(queryKey ?? [{ userId }])];
export type LlmsServiceListModelsDefaultResponse = Awaited<
  ReturnType<typeof LlmsService.listModels>
>;
export type LlmsServiceListModelsQueryResult<
  TData = LlmsServiceListModelsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useLlmsServiceListModelsKey = 'LlmsServiceListModels';
export const UseLlmsServiceListModelsKeyFn = (
  {
    providerCategory,
    providerName,
    providerType,
    userId,
  }: {
    providerCategory?: ProviderCategory[];
    providerName?: string;
    providerType?: ProviderType;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useLlmsServiceListModelsKey,
  ...(queryKey ?? [{ providerCategory, providerName, providerType, userId }]),
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
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useLlmsServiceListEmbeddingModelsKey, ...(queryKey ?? [{ userId }])];
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
    after,
    before,
    connectedToAgentsCountEq,
    connectedToAgentsCountGt,
    connectedToAgentsCountLt,
    descriptionSearch,
    identifierKeys,
    identityId,
    label,
    labelSearch,
    limit,
    name,
    projectId,
    templatesOnly,
    userId,
    valueSearch,
  }: {
    after?: string;
    before?: string;
    connectedToAgentsCountEq?: number[];
    connectedToAgentsCountGt?: number;
    connectedToAgentsCountLt?: number;
    descriptionSearch?: string;
    identifierKeys?: string[];
    identityId?: string;
    label?: string;
    labelSearch?: string;
    limit?: number;
    name?: string;
    projectId?: string;
    templatesOnly?: boolean;
    userId?: string;
    valueSearch?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useBlocksServiceListBlocksKey,
  ...(queryKey ?? [
    {
      after,
      before,
      connectedToAgentsCountEq,
      connectedToAgentsCountGt,
      connectedToAgentsCountLt,
      descriptionSearch,
      identifierKeys,
      identityId,
      label,
      labelSearch,
      limit,
      name,
      projectId,
      templatesOnly,
      userId,
      valueSearch,
    },
  ]),
];
export type BlocksServiceCountBlocksDefaultResponse = Awaited<
  ReturnType<typeof BlocksService.countBlocks>
>;
export type BlocksServiceCountBlocksQueryResult<
  TData = BlocksServiceCountBlocksDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useBlocksServiceCountBlocksKey = 'BlocksServiceCountBlocks';
export const UseBlocksServiceCountBlocksKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useBlocksServiceCountBlocksKey, ...(queryKey ?? [{ userId }])];
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
    includeRelationships,
    userId,
  }: {
    blockId: string;
    includeRelationships?: string[];
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useBlocksServiceListAgentsForBlockKey,
  ...(queryKey ?? [{ blockId, includeRelationships, userId }]),
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
    after,
    ascending,
    before,
    limit,
    sourceId,
    userId,
  }: {
    after?: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    sourceId?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useJobsServiceListJobsKey,
  ...(queryKey ?? [{ after, ascending, before, limit, sourceId, userId }]),
];
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
    after,
    ascending,
    before,
    limit,
    sourceId,
    userId,
  }: {
    after?: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    sourceId?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useJobsServiceListActiveJobsKey,
  ...(queryKey ?? [{ after, ascending, before, limit, sourceId, userId }]),
];
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
    name,
    providerType,
    userId,
  }: {
    after?: string;
    limit?: number;
    name?: string;
    providerType?: ProviderType;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useProvidersServiceListProvidersKey,
  ...(queryKey ?? [{ after, limit, name, providerType, userId }]),
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
    after,
    agentIds,
    ascending,
    background,
    before,
    limit,
    userId,
  }: {
    after?: string;
    agentIds?: string[];
    ascending?: boolean;
    background?: boolean;
    before?: string;
    limit?: number;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useRunsServiceListRunsKey,
  ...(queryKey ?? [
    { after, agentIds, ascending, background, before, limit, userId },
  ]),
];
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
    background,
    userId,
  }: {
    agentIds?: string[];
    background?: boolean;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useRunsServiceListActiveRunsKey,
  ...(queryKey ?? [{ agentIds, background, userId }]),
];
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
    feedback,
    hasFeedback,
    limit,
    model,
    order,
    projectId,
    startDate,
    tags,
    traceIds,
    userId,
    xProject,
  }: {
    after?: string;
    agentId?: string;
    before?: string;
    endDate?: string;
    feedback?: 'positive' | 'negative';
    hasFeedback?: boolean;
    limit?: number;
    model?: string;
    order?: string;
    projectId?: string;
    startDate?: string;
    tags?: string[];
    traceIds?: string[];
    userId?: string;
    xProject?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useStepsServiceListStepsKey,
  ...(queryKey ?? [
    {
      after,
      agentId,
      before,
      endDate,
      feedback,
      hasFeedback,
      limit,
      model,
      order,
      projectId,
      startDate,
      tags,
      traceIds,
      userId,
      xProject,
    },
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
export type StepsServiceRetrieveStepMetricsDefaultResponse = Awaited<
  ReturnType<typeof StepsService.retrieveStepMetrics>
>;
export type StepsServiceRetrieveStepMetricsQueryResult<
  TData = StepsServiceRetrieveStepMetricsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useStepsServiceRetrieveStepMetricsKey =
  'StepsServiceRetrieveStepMetrics';
export const UseStepsServiceRetrieveStepMetricsKeyFn = (
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useStepsServiceRetrieveStepMetricsKey,
  ...(queryKey ?? [{ stepId, userId }]),
];
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
export type TelemetryServiceRetrieveProviderTraceDefaultResponse = Awaited<
  ReturnType<typeof TelemetryService.retrieveProviderTrace>
>;
export type TelemetryServiceRetrieveProviderTraceQueryResult<
  TData = TelemetryServiceRetrieveProviderTraceDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useTelemetryServiceRetrieveProviderTraceKey =
  'TelemetryServiceRetrieveProviderTrace';
export const UseTelemetryServiceRetrieveProviderTraceKeyFn = (
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useTelemetryServiceRetrieveProviderTraceKey,
  ...(queryKey ?? [{ stepId, userId }]),
];
export type MessagesServiceListBatchRunsDefaultResponse = Awaited<
  ReturnType<typeof MessagesService.listBatchRuns>
>;
export type MessagesServiceListBatchRunsQueryResult<
  TData = MessagesServiceListBatchRunsDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useMessagesServiceListBatchRunsKey =
  'MessagesServiceListBatchRuns';
export const UseMessagesServiceListBatchRunsKeyFn = (
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [useMessagesServiceListBatchRunsKey, ...(queryKey ?? [{ userId }])];
export type MessagesServiceRetrieveBatchRunDefaultResponse = Awaited<
  ReturnType<typeof MessagesService.retrieveBatchRun>
>;
export type MessagesServiceRetrieveBatchRunQueryResult<
  TData = MessagesServiceRetrieveBatchRunDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useMessagesServiceRetrieveBatchRunKey =
  'MessagesServiceRetrieveBatchRun';
export const UseMessagesServiceRetrieveBatchRunKeyFn = (
  {
    batchId,
    userId,
  }: {
    batchId: string;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useMessagesServiceRetrieveBatchRunKey,
  ...(queryKey ?? [{ batchId, userId }]),
];
export type MessagesServiceListBatchMessagesDefaultResponse = Awaited<
  ReturnType<typeof MessagesService.listBatchMessages>
>;
export type MessagesServiceListBatchMessagesQueryResult<
  TData = MessagesServiceListBatchMessagesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useMessagesServiceListBatchMessagesKey =
  'MessagesServiceListBatchMessages';
export const UseMessagesServiceListBatchMessagesKeyFn = (
  {
    agentId,
    batchId,
    cursor,
    limit,
    sortDescending,
    userId,
  }: {
    agentId?: string;
    batchId: string;
    cursor?: string;
    limit?: number;
    sortDescending?: boolean;
    userId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useMessagesServiceListBatchMessagesKey,
  ...(queryKey ?? [
    { agentId, batchId, cursor, limit, sortDescending, userId },
  ]),
];
export type EmbeddingsServiceGetTotalStorageSizeDefaultResponse = Awaited<
  ReturnType<typeof EmbeddingsService.getTotalStorageSize>
>;
export type EmbeddingsServiceGetTotalStorageSizeQueryResult<
  TData = EmbeddingsServiceGetTotalStorageSizeDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useEmbeddingsServiceGetTotalStorageSizeKey =
  'EmbeddingsServiceGetTotalStorageSize';
export const UseEmbeddingsServiceGetTotalStorageSizeKeyFn = (
  {
    storageUnit,
    userId,
  }: {
    storageUnit?: string;
    userId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useEmbeddingsServiceGetTotalStorageSizeKey,
  ...(queryKey ?? [{ storageUnit, userId }]),
];
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
export type ToolsServiceTestMcpServerMutationResult = Awaited<
  ReturnType<typeof ToolsService.testMcpServer>
>;
export type ToolsServiceConnectMcpServerMutationResult = Awaited<
  ReturnType<typeof ToolsService.connectMcpServer>
>;
export type ToolsServiceGenerateJsonSchemaMutationResult = Awaited<
  ReturnType<typeof ToolsService.generateJsonSchema>
>;
export type ToolsServiceExecuteMcpToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.executeMcpTool>
>;
export type ToolsServiceGenerateToolMutationResult = Awaited<
  ReturnType<typeof ToolsService.generateTool>
>;
export type SourcesServiceCreateSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.createSource>
>;
export type SourcesServiceUploadFileToSourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.uploadFileToSource>
>;
export type FoldersServiceCreateFolderMutationResult = Awaited<
  ReturnType<typeof FoldersService.createFolder>
>;
export type FoldersServiceUploadFileToFolderMutationResult = Awaited<
  ReturnType<typeof FoldersService.uploadFileToFolder>
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
export type AgentsServiceCancelAgentRunMutationResult = Awaited<
  ReturnType<typeof AgentsService.cancelAgentRun>
>;
export type AgentsServiceCreateAgentMessageAsyncMutationResult = Awaited<
  ReturnType<typeof AgentsService.createAgentMessageAsync>
>;
export type AgentsServicePreviewRawPayloadMutationResult = Awaited<
  ReturnType<typeof AgentsService.previewRawPayload>
>;
export type AgentsServiceSummarizeAgentConversationMutationResult = Awaited<
  ReturnType<typeof AgentsService.summarizeAgentConversation>
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
export type ProvidersServiceCheckProviderMutationResult = Awaited<
  ReturnType<typeof ProvidersService.checkProvider>
>;
export type RunsServiceRetrieveStreamMutationResult = Awaited<
  ReturnType<typeof RunsService.retrieveStream>
>;
export type AdminServiceCreateUserMutationResult = Awaited<
  ReturnType<typeof AdminService.createUser>
>;
export type AdminServiceCreateOrganizationMutationResult = Awaited<
  ReturnType<typeof AdminService.createOrganization>
>;
export type MessagesServiceCreateMessagesBatchMutationResult = Awaited<
  ReturnType<typeof MessagesService.createMessagesBatch>
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
export type ToolsServiceUpdateMcpServerMutationResult = Awaited<
  ReturnType<typeof ToolsService.updateMcpServer>
>;
export type SourcesServiceModifySourceMutationResult = Awaited<
  ReturnType<typeof SourcesService.modifySource>
>;
export type FoldersServiceModifyFolderMutationResult = Awaited<
  ReturnType<typeof FoldersService.modifyFolder>
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
export type AgentsServiceAttachFolderToAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.attachFolderToAgent>
>;
export type AgentsServiceDetachSourceFromAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.detachSourceFromAgent>
>;
export type AgentsServiceDetachFolderFromAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.detachFolderFromAgent>
>;
export type AgentsServiceCloseAllOpenFilesMutationResult = Awaited<
  ReturnType<typeof AgentsService.closeAllOpenFiles>
>;
export type AgentsServiceOpenFileMutationResult = Awaited<
  ReturnType<typeof AgentsService.openFile>
>;
export type AgentsServiceCloseFileMutationResult = Awaited<
  ReturnType<typeof AgentsService.closeFile>
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
export type JobsServiceCancelJobMutationResult = Awaited<
  ReturnType<typeof JobsService.cancelJob>
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
export type StepsServiceAddFeedbackMutationResult = Awaited<
  ReturnType<typeof StepsService.addFeedback>
>;
export type StepsServiceUpdateStepTransactionIdMutationResult = Awaited<
  ReturnType<typeof StepsService.updateStepTransactionId>
>;
export type AdminServiceUpdateOrganizationMutationResult = Awaited<
  ReturnType<typeof AdminService.updateOrganization>
>;
export type MessagesServiceCancelBatchRunMutationResult = Awaited<
  ReturnType<typeof MessagesService.cancelBatchRun>
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
export type FoldersServiceDeleteFolderMutationResult = Awaited<
  ReturnType<typeof FoldersService.deleteFolder>
>;
export type FoldersServiceDeleteFileFromFolderMutationResult = Awaited<
  ReturnType<typeof FoldersService.deleteFileFromFolder>
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

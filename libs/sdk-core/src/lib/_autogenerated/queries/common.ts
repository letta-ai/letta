// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryResult } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
  ArchivesService,
  AuthService,
  BlocksService,
  EmbeddingsService,
  FoldersService,
  GroupsService,
  HealthService,
  IdentitiesService,
  InternalTemplatesService,
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
  Body_export_agent,
  IdentityType,
  ManagerType,
  ProviderCategory,
  ProviderType,
  SandboxType,
  StopReasonType,
} from '../requests/types.gen';
export type ArchivesServiceListArchivesDefaultResponse = Awaited<
  ReturnType<typeof ArchivesService.listArchives>
>;
export type ArchivesServiceListArchivesQueryResult<
  TData = ArchivesServiceListArchivesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useArchivesServiceListArchivesKey = 'ArchivesServiceListArchives';
export const UseArchivesServiceListArchivesKeyFn = (
  {
    after,
    agentId,
    before,
    limit,
    name,
    order,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    agentId?: string;
    before?: string;
    limit?: number;
    name?: string;
    order?: 'asc' | 'desc';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useArchivesServiceListArchivesKey,
  ...(queryKey ?? [
    {
      after,
      agentId,
      before,
      limit,
      name,
      order,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    toolId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useToolsServiceRetrieveToolKey,
  ...(queryKey ?? [
    {
      toolId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    excludeLettaTools,
    excludeToolTypes,
    name,
    names,
    returnOnlyLettaTools,
    search,
    toolIds,
    toolTypes,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    excludeLettaTools?: boolean;
    excludeToolTypes?: string[];
    name?: string;
    names?: string[];
    returnOnlyLettaTools?: boolean;
    search?: string;
    toolIds?: string[];
    toolTypes?: string[];
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useToolsServiceCountToolsKey,
  ...(queryKey ?? [
    {
      excludeLettaTools,
      excludeToolTypes,
      name,
      names,
      returnOnlyLettaTools,
      search,
      toolIds,
      toolTypes,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    before,
    excludeToolTypes,
    limit,
    name,
    names,
    order,
    orderBy,
    returnOnlyLettaTools,
    search,
    toolIds,
    toolTypes,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    excludeToolTypes?: string[];
    limit?: number;
    name?: string;
    names?: string[];
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    returnOnlyLettaTools?: boolean;
    search?: string;
    toolIds?: string[];
    toolTypes?: string[];
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useToolsServiceListToolsKey,
  ...(queryKey ?? [
    {
      after,
      before,
      excludeToolTypes,
      limit,
      name,
      names,
      order,
      orderBy,
      returnOnlyLettaTools,
      search,
      toolIds,
      toolTypes,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useToolsServiceListComposioAppsKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    composioAppName: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useToolsServiceListComposioActionsByAppKey,
  ...(queryKey ?? [
    {
      composioAppName,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useToolsServiceListMcpServersKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    mcpServerName: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useToolsServiceListMcpToolsByServerKey,
  ...(queryKey ?? [
    {
      mcpServerName,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceCountSourcesKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceRetrieveSourceKey,
  ...(queryKey ?? [
    {
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    sourceName: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceGetSourceIdByNameKey,
  ...(queryKey ?? [
    {
      sourceName,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    includeDetailedPerSourceMetadata?: boolean;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceGetSourcesMetadataKey,
  ...(queryKey ?? [
    {
      includeDetailedPerSourceMetadata,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceListSourcesKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceGetAgentsForSourceKey,
  ...(queryKey ?? [
    {
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceListSourcePassagesKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    checkStatusUpdates?: boolean;
    includeContent?: boolean;
    limit?: number;
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceListSourceFilesKey,
  ...(queryKey ?? [
    {
      after,
      checkStatusUpdates,
      includeContent,
      limit,
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    fileId: string;
    includeContent?: boolean;
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useSourcesServiceGetFileMetadataKey,
  ...(queryKey ?? [
    {
      fileId,
      includeContent,
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceCountFoldersKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    folderId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceRetrieveFolderKey,
  ...(queryKey ?? [
    {
      folderId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type FoldersServiceGetFolderByNameDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.getFolderByName>
>;
export type FoldersServiceGetFolderByNameQueryResult<
  TData = FoldersServiceGetFolderByNameDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceGetFolderByNameKey =
  'FoldersServiceGetFolderByName';
export const UseFoldersServiceGetFolderByNameKeyFn = (
  {
    folderName,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    folderName: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceGetFolderByNameKey,
  ...(queryKey ?? [
    {
      folderName,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type FoldersServiceRetrieveMetadataDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.retrieveMetadata>
>;
export type FoldersServiceRetrieveMetadataQueryResult<
  TData = FoldersServiceRetrieveMetadataDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceRetrieveMetadataKey =
  'FoldersServiceRetrieveMetadata';
export const UseFoldersServiceRetrieveMetadataKeyFn = (
  {
    includeDetailedPerSourceMetadata,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    includeDetailedPerSourceMetadata?: boolean;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceRetrieveMetadataKey,
  ...(queryKey ?? [
    {
      includeDetailedPerSourceMetadata,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    after,
    before,
    limit,
    name,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    name?: string;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceListFoldersKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      name,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type FoldersServiceListAgentsForFolderDefaultResponse = Awaited<
  ReturnType<typeof FoldersService.listAgentsForFolder>
>;
export type FoldersServiceListAgentsForFolderQueryResult<
  TData = FoldersServiceListAgentsForFolderDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useFoldersServiceListAgentsForFolderKey =
  'FoldersServiceListAgentsForFolder';
export const UseFoldersServiceListAgentsForFolderKeyFn = (
  {
    after,
    before,
    folderId,
    limit,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    folderId: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceListAgentsForFolderKey,
  ...(queryKey ?? [
    {
      after,
      before,
      folderId,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    folderId: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceListFolderPassagesKey,
  ...(queryKey ?? [
    {
      after,
      before,
      folderId,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    before,
    folderId,
    includeContent,
    limit,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    folderId: string;
    includeContent?: boolean;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useFoldersServiceListFolderFilesKey,
  ...(queryKey ?? [
    {
      after,
      before,
      folderId,
      includeContent,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    order,
    orderBy,
    projectId,
    queryText,
    sortBy,
    tags,
    templateId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
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
    order?: 'asc' | 'desc';
    orderBy?: 'created_at' | 'last_run_completion';
    projectId?: string;
    queryText?: string;
    sortBy?: string;
    tags?: string[];
    templateId?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
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
      order,
      orderBy,
      projectId,
      queryText,
      sortBy,
      tags,
      templateId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceCountAgentsKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type AgentsServiceExportAgentDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.exportAgent>
>;
export type AgentsServiceExportAgentQueryResult<
  TData = AgentsServiceExportAgentDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceExportAgentKey = 'AgentsServiceExportAgent';
export const UseAgentsServiceExportAgentKeyFn = (
  {
    agentId,
    maxSteps,
    requestBody,
    useLegacyFormat,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    maxSteps?: number;
    requestBody?: Body_export_agent;
    useLegacyFormat?: boolean;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceExportAgentKey,
  ...(queryKey ?? [
    {
      agentId,
      maxSteps,
      requestBody,
      useLegacyFormat,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceRetrieveAgentContextWindowKey,
  ...(queryKey ?? [
    {
      agentId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    includeRelationships?: string[];
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceRetrieveAgentKey,
  ...(queryKey ?? [
    {
      agentId,
      includeRelationships,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentToolsKey,
  ...(queryKey ?? [
    {
      agentId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentSourcesKey,
  ...(queryKey ?? [
    {
      agentId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentFoldersKey,
  ...(queryKey ?? [
    {
      agentId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    cursor?: string;
    isOpen?: boolean;
    limit?: number;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentFilesKey,
  ...(queryKey ?? [
    {
      agentId,
      cursor,
      isOpen,
      limit,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceRetrieveAgentMemoryKey,
  ...(queryKey ?? [
    {
      agentId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    blockLabel: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceRetrieveCoreMemoryBlockKey,
  ...(queryKey ?? [
    {
      agentId,
      blockLabel,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListCoreMemoryBlocksKey,
  ...(queryKey ?? [
    {
      agentId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    agentId: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    search?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListPassagesKey,
  ...(queryKey ?? [
    {
      after,
      agentId,
      ascending,
      before,
      limit,
      search,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type AgentsServiceSearchArchivalMemoryDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.searchArchivalMemory>
>;
export type AgentsServiceSearchArchivalMemoryQueryResult<
  TData = AgentsServiceSearchArchivalMemoryDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useAgentsServiceSearchArchivalMemoryKey =
  'AgentsServiceSearchArchivalMemory';
export const UseAgentsServiceSearchArchivalMemoryKeyFn = (
  {
    agentId,
    endDatetime,
    query,
    startDatetime,
    tagMatchMode,
    tags,
    topK,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    endDatetime?: string;
    query: string;
    startDatetime?: string;
    tagMatchMode?: 'any' | 'all';
    tags?: string[];
    topK?: number;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceSearchArchivalMemoryKey,
  ...(queryKey ?? [
    {
      agentId,
      endDatetime,
      query,
      startDatetime,
      tagMatchMode,
      tags,
      topK,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
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
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
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
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId: string;
    managerType?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useAgentsServiceListAgentGroupsKey,
  ...(queryKey ?? [
    {
      agentId,
      managerType,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
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
    order,
    orderBy,
    projectId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    managerType?: ManagerType;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    projectId?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useGroupsServiceListGroupsKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      managerType,
      order,
      orderBy,
      projectId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useGroupsServiceCountGroupsKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    groupId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useGroupsServiceRetrieveGroupKey,
  ...(queryKey ?? [
    {
      groupId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    order,
    orderBy,
    useAssistantMessage,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    assistantMessageToolKwarg?: string;
    assistantMessageToolName?: string;
    before?: string;
    groupId: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    useAssistantMessage?: boolean;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
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
      order,
      orderBy,
      useAssistantMessage,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
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
    order,
    orderBy,
    projectId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    identifierKey?: string;
    identityType?: IdentityType;
    limit?: number;
    name?: string;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    projectId?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
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
      order,
      orderBy,
      projectId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useIdentitiesServiceCountIdentitiesKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    identityId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useIdentitiesServiceRetrieveIdentityKey,
  ...(queryKey ?? [
    {
      identityId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type IdentitiesServiceListAgentsForIdentityDefaultResponse = Awaited<
  ReturnType<typeof IdentitiesService.listAgentsForIdentity>
>;
export type IdentitiesServiceListAgentsForIdentityQueryResult<
  TData = IdentitiesServiceListAgentsForIdentityDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useIdentitiesServiceListAgentsForIdentityKey =
  'IdentitiesServiceListAgentsForIdentity';
export const UseIdentitiesServiceListAgentsForIdentityKeyFn = (
  {
    after,
    before,
    identityId,
    limit,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    identityId: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useIdentitiesServiceListAgentsForIdentityKey,
  ...(queryKey ?? [
    {
      after,
      before,
      identityId,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type IdentitiesServiceListBlocksForIdentityDefaultResponse = Awaited<
  ReturnType<typeof IdentitiesService.listBlocksForIdentity>
>;
export type IdentitiesServiceListBlocksForIdentityQueryResult<
  TData = IdentitiesServiceListBlocksForIdentityDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useIdentitiesServiceListBlocksForIdentityKey =
  'IdentitiesServiceListBlocksForIdentity';
export const UseIdentitiesServiceListBlocksForIdentityKeyFn = (
  {
    after,
    before,
    identityId,
    limit,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    identityId: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useIdentitiesServiceListBlocksForIdentityKey,
  ...(queryKey ?? [
    {
      after,
      before,
      identityId,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type InternalTemplatesServiceListDeploymentEntitiesDefaultResponse =
  Awaited<ReturnType<typeof InternalTemplatesService.listDeploymentEntities>>;
export type InternalTemplatesServiceListDeploymentEntitiesQueryResult<
  TData = InternalTemplatesServiceListDeploymentEntitiesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useInternalTemplatesServiceListDeploymentEntitiesKey =
  'InternalTemplatesServiceListDeploymentEntities';
export const UseInternalTemplatesServiceListDeploymentEntitiesKeyFn = (
  {
    deploymentId,
    entityTypes,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    deploymentId: string;
    entityTypes?: string[];
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useInternalTemplatesServiceListDeploymentEntitiesKey,
  ...(queryKey ?? [
    {
      deploymentId,
      entityTypes,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    providerCategory?: ProviderCategory[];
    providerName?: string;
    providerType?: ProviderType;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useModelsServiceListModelsKey,
  ...(queryKey ?? [
    {
      providerCategory,
      providerName,
      providerType,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useModelsServiceListEmbeddingModelsKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    providerCategory?: ProviderCategory[];
    providerName?: string;
    providerType?: ProviderType;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useLlmsServiceListModelsKey,
  ...(queryKey ?? [
    {
      providerCategory,
      providerName,
      providerType,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useLlmsServiceListEmbeddingModelsKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    order,
    orderBy,
    projectId,
    templatesOnly,
    userAgent,
    userId,
    valueSearch,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
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
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    projectId?: string;
    templatesOnly?: boolean;
    userAgent?: string;
    userId?: string;
    valueSearch?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
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
      order,
      orderBy,
      projectId,
      templatesOnly,
      userAgent,
      userId,
      valueSearch,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useBlocksServiceCountBlocksKey,
  ...(queryKey ?? [
    {
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    blockId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useBlocksServiceRetrieveBlockKey,
  ...(queryKey ?? [
    {
      blockId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    after,
    before,
    blockId,
    includeRelationships,
    limit,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    blockId: string;
    includeRelationships?: string[];
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useBlocksServiceListAgentsForBlockKey,
  ...(queryKey ?? [
    {
      after,
      before,
      blockId,
      includeRelationships,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    active,
    after,
    ascending,
    before,
    limit,
    order,
    orderBy,
    sourceId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    active?: boolean;
    after?: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    sourceId?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useJobsServiceListJobsKey,
  ...(queryKey ?? [
    {
      active,
      after,
      ascending,
      before,
      limit,
      order,
      orderBy,
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    sourceId?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useJobsServiceListActiveJobsKey,
  ...(queryKey ?? [
    {
      after,
      ascending,
      before,
      limit,
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    jobId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useJobsServiceRetrieveJobKey,
  ...(queryKey ?? [
    {
      jobId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type HealthServiceCheckHealthDefaultResponse = Awaited<
  ReturnType<typeof HealthService.checkHealth>
>;
export type HealthServiceCheckHealthQueryResult<
  TData = HealthServiceCheckHealthDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useHealthServiceCheckHealthKey = 'HealthServiceCheckHealth';
export const UseHealthServiceCheckHealthKeyFn = (queryKey?: Array<unknown>) => [
  useHealthServiceCheckHealthKey,
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
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }: {
      after?: string;
      limit?: number;
      sandboxType?: SandboxType;
      userAgent?: string;
      userId?: string;
      xExperimentalLettaV1Agent?: string;
      xExperimentalMessageAsync?: string;
      xProjectId?: string;
    } = {},
    queryKey?: Array<unknown>,
  ) => [
    useSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKey,
    ...(queryKey ?? [
      {
        after,
        limit,
        sandboxType,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
    ]),
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
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }: {
      after?: string;
      limit?: number;
      sandboxConfigId: string;
      userAgent?: string;
      userId?: string;
      xExperimentalLettaV1Agent?: string;
      xExperimentalMessageAsync?: string;
      xProjectId?: string;
    },
    queryKey?: Array<unknown>,
  ) => [
    useSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKey,
    ...(queryKey ?? [
      {
        after,
        limit,
        sandboxConfigId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
    ]),
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
    before,
    limit,
    name,
    order,
    orderBy,
    providerType,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    name?: string;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    providerType?: ProviderType;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useProvidersServiceListProvidersKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      name,
      order,
      orderBy,
      providerType,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type ProvidersServiceRetrieveProviderDefaultResponse = Awaited<
  ReturnType<typeof ProvidersService.retrieveProvider>
>;
export type ProvidersServiceRetrieveProviderQueryResult<
  TData = ProvidersServiceRetrieveProviderDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useProvidersServiceRetrieveProviderKey =
  'ProvidersServiceRetrieveProvider';
export const UseProvidersServiceRetrieveProviderKeyFn = (
  {
    providerId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    providerId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useProvidersServiceRetrieveProviderKey,
  ...(queryKey ?? [
    {
      providerId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    active,
    after,
    agentId,
    agentIds,
    ascending,
    background,
    before,
    limit,
    order,
    orderBy,
    stopReason,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    active?: boolean;
    after?: string;
    agentId?: string;
    agentIds?: string[];
    ascending?: boolean;
    background?: boolean;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    stopReason?: StopReasonType;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useRunsServiceListRunsKey,
  ...(queryKey ?? [
    {
      active,
      after,
      agentId,
      agentIds,
      ascending,
      background,
      before,
      limit,
      order,
      orderBy,
      stopReason,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
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
    agentId,
    background,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    agentId?: string;
    background?: boolean;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useRunsServiceListActiveRunsKey,
  ...(queryKey ?? [
    {
      agentId,
      background,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    runId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useRunsServiceRetrieveRunKey,
  ...(queryKey ?? [
    {
      runId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    orderBy,
    runId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    runId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useRunsServiceListRunMessagesKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      order,
      orderBy,
      runId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    runId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useRunsServiceRetrieveRunUsageKey,
  ...(queryKey ?? [
    {
      runId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
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
    orderBy,
    runId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    runId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useRunsServiceListRunStepsKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      order,
      orderBy,
      runId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    orderBy,
    projectId,
    startDate,
    tags,
    traceIds,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProject,
    xProjectId,
  }: {
    after?: string;
    agentId?: string;
    before?: string;
    endDate?: string;
    feedback?: 'positive' | 'negative';
    hasFeedback?: boolean;
    limit?: number;
    model?: string;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    projectId?: string;
    startDate?: string;
    tags?: string[];
    traceIds?: string[];
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProject?: string;
    xProjectId?: string;
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
      orderBy,
      projectId,
      startDate,
      tags,
      traceIds,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProject,
      xProjectId,
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    stepId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useStepsServiceRetrieveStepKey,
  ...(queryKey ?? [
    {
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type StepsServiceRetrieveMetricsForStepDefaultResponse = Awaited<
  ReturnType<typeof StepsService.retrieveMetricsForStep>
>;
export type StepsServiceRetrieveMetricsForStepQueryResult<
  TData = StepsServiceRetrieveMetricsForStepDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useStepsServiceRetrieveMetricsForStepKey =
  'StepsServiceRetrieveMetricsForStep';
export const UseStepsServiceRetrieveMetricsForStepKeyFn = (
  {
    stepId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    stepId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useStepsServiceRetrieveMetricsForStepKey,
  ...(queryKey ?? [
    {
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type StepsServiceRetrieveTraceForStepDefaultResponse = Awaited<
  ReturnType<typeof StepsService.retrieveTraceForStep>
>;
export type StepsServiceRetrieveTraceForStepQueryResult<
  TData = StepsServiceRetrieveTraceForStepDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useStepsServiceRetrieveTraceForStepKey =
  'StepsServiceRetrieveTraceForStep';
export const UseStepsServiceRetrieveTraceForStepKeyFn = (
  {
    stepId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    stepId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useStepsServiceRetrieveTraceForStepKey,
  ...(queryKey ?? [
    {
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type StepsServiceListMessagesForStepDefaultResponse = Awaited<
  ReturnType<typeof StepsService.listMessagesForStep>
>;
export type StepsServiceListMessagesForStepQueryResult<
  TData = StepsServiceListMessagesForStepDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useStepsServiceListMessagesForStepKey =
  'StepsServiceListMessagesForStep';
export const UseStepsServiceListMessagesForStepKeyFn = (
  {
    after,
    before,
    limit,
    order,
    orderBy,
    stepId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    stepId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useStepsServiceListMessagesForStepKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      order,
      orderBy,
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    before,
    limit,
    name,
    order,
    orderBy,
    queryText,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    name?: string;
    order?: 'asc' | 'desc';
    orderBy?: 'name';
    queryText?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useTagServiceListTagsKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      name,
      order,
      orderBy,
      queryText,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    before,
    limit,
    name,
    order,
    orderBy,
    queryText,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    name?: string;
    order?: 'asc' | 'desc';
    orderBy?: 'name';
    queryText?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useAdminServiceListTagsKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      name,
      order,
      orderBy,
      queryText,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    stepId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useTelemetryServiceRetrieveProviderTraceKey,
  ...(queryKey ?? [
    {
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type MessagesServiceListBatchesDefaultResponse = Awaited<
  ReturnType<typeof MessagesService.listBatches>
>;
export type MessagesServiceListBatchesQueryResult<
  TData = MessagesServiceListBatchesDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useMessagesServiceListBatchesKey = 'MessagesServiceListBatches';
export const UseMessagesServiceListBatchesKeyFn = (
  {
    after,
    before,
    limit,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useMessagesServiceListBatchesKey,
  ...(queryKey ?? [
    {
      after,
      before,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type MessagesServiceRetrieveBatchDefaultResponse = Awaited<
  ReturnType<typeof MessagesService.retrieveBatch>
>;
export type MessagesServiceRetrieveBatchQueryResult<
  TData = MessagesServiceRetrieveBatchDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useMessagesServiceRetrieveBatchKey =
  'MessagesServiceRetrieveBatch';
export const UseMessagesServiceRetrieveBatchKeyFn = (
  {
    batchId,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    batchId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useMessagesServiceRetrieveBatchKey,
  ...(queryKey ?? [
    {
      batchId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
];
export type MessagesServiceListMessagesForBatchDefaultResponse = Awaited<
  ReturnType<typeof MessagesService.listMessagesForBatch>
>;
export type MessagesServiceListMessagesForBatchQueryResult<
  TData = MessagesServiceListMessagesForBatchDefaultResponse,
  TError = unknown,
> = UseQueryResult<TData, TError>;
export const useMessagesServiceListMessagesForBatchKey =
  'MessagesServiceListMessagesForBatch';
export const UseMessagesServiceListMessagesForBatchKeyFn = (
  {
    after,
    agentId,
    batchId,
    before,
    limit,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    agentId?: string;
    batchId: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: Array<unknown>,
) => [
  useMessagesServiceListMessagesForBatchKey,
  ...(queryKey ?? [
    {
      after,
      agentId,
      batchId,
      before,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
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
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    storageUnit?: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: Array<unknown>,
) => [
  useEmbeddingsServiceGetTotalStorageSizeKey,
  ...(queryKey ?? [
    {
      storageUnit,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    },
  ]),
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
export type ArchivesServiceCreateArchiveMutationResult = Awaited<
  ReturnType<typeof ArchivesService.createArchive>
>;
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
export type ToolsServiceResyncMcpServerToolsMutationResult = Awaited<
  ReturnType<typeof ToolsService.resyncMcpServerTools>
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
export type AgentsServiceImportAgentMutationResult = Awaited<
  ReturnType<typeof AgentsService.importAgent>
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
export type AgentsServiceSearchMessagesMutationResult = Awaited<
  ReturnType<typeof AgentsService.searchMessages>
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
export type InternalTemplatesServiceCreateInternalTemplateGroupMutationResult =
  Awaited<
    ReturnType<typeof InternalTemplatesService.createInternalTemplateGroup>
  >;
export type InternalTemplatesServiceCreateInternalTemplateAgentMutationResult =
  Awaited<
    ReturnType<typeof InternalTemplatesService.createInternalTemplateAgent>
  >;
export type InternalTemplatesServiceCreateInternalTemplateBlockMutationResult =
  Awaited<
    ReturnType<typeof InternalTemplatesService.createInternalTemplateBlock>
  >;
export type InternalTemplatesServiceCreateInternalTemplateBlocksBatchMutationResult =
  Awaited<
    ReturnType<
      typeof InternalTemplatesService.createInternalTemplateBlocksBatch
    >
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
export type MessagesServiceCreateBatchMutationResult = Awaited<
  ReturnType<typeof MessagesService.createBatch>
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
export type ArchivesServiceModifyArchiveMutationResult = Awaited<
  ReturnType<typeof ArchivesService.modifyArchive>
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
export type AgentsServiceModifyApprovalMutationResult = Awaited<
  ReturnType<typeof AgentsService.modifyApproval>
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
export type StepsServiceModifyFeedbackForStepMutationResult = Awaited<
  ReturnType<typeof StepsService.modifyFeedbackForStep>
>;
export type StepsServiceUpdateStepTransactionIdMutationResult = Awaited<
  ReturnType<typeof StepsService.updateStepTransactionId>
>;
export type AdminServiceUpdateOrganizationMutationResult = Awaited<
  ReturnType<typeof AdminService.updateOrganization>
>;
export type MessagesServiceCancelBatchMutationResult = Awaited<
  ReturnType<typeof MessagesService.cancelBatch>
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
export type InternalTemplatesServiceDeleteDeploymentMutationResult = Awaited<
  ReturnType<typeof InternalTemplatesService.deleteDeployment>
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

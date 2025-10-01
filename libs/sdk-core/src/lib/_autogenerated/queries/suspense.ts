// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryOptions, useSuspenseQuery } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
  ArchivesService,
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
import * as Common from './common';
/**
 * List Archives
 * Get a list of all archives for the current organization with optional filters and pagination.
 * @param data The data for the request.
 * @param data.before Archive ID cursor for pagination. Returns archives that come before this archive ID in the specified sort order
 * @param data.after Archive ID cursor for pagination. Returns archives that come after this archive ID in the specified sort order
 * @param data.limit Maximum number of archives to return
 * @param data.order Sort order for archives by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.name Filter by archive name (exact match)
 * @param data.agentId Only archives attached to this agent ID
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Archive Successful Response
 * @throws ApiError
 */
export const useArchivesServiceListArchivesSuspense = <
  TData = Common.ArchivesServiceListArchivesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseArchivesServiceListArchivesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      ArchivesService.listArchives({
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
      }) as TData,
    ...options,
  });
/**
 * Retrieve Tool
 * Get a tool by ID
 * @param data The data for the request.
 * @param data.toolId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceRetrieveToolSuspense = <
  TData = Common.ToolsServiceRetrieveToolDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceRetrieveToolKeyFn(
      {
        toolId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.retrieveTool({
        toolId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Count Tools
 * Get a count of all tools available to agents belonging to the org of the user.
 * @param data The data for the request.
 * @param data.name
 * @param data.names Filter by specific tool names
 * @param data.toolIds Filter by specific tool IDs - accepts repeated params or comma-separated values
 * @param data.search Search tool names (case-insensitive partial match)
 * @param data.toolTypes Filter by tool type(s) - accepts repeated params or comma-separated values
 * @param data.excludeToolTypes Tool type(s) to exclude - accepts repeated params or comma-separated values
 * @param data.returnOnlyLettaTools Count only tools with tool_type starting with 'letta_'
 * @param data.excludeLettaTools Exclude built-in Letta tools from the count
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns number Successful Response
 * @throws ApiError
 */
export const useToolsServiceCountToolsSuspense = <
  TData = Common.ToolsServiceCountToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceCountToolsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      ToolsService.countTools({
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
      }) as TData,
    ...options,
  });
/**
 * List Tools
 * Get a list of all tools available to agents.
 * @param data The data for the request.
 * @param data.before Tool ID cursor for pagination. Returns tools that come before this tool ID in the specified sort order
 * @param data.after Tool ID cursor for pagination. Returns tools that come after this tool ID in the specified sort order
 * @param data.limit Maximum number of tools to return
 * @param data.order Sort order for tools by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.name Filter by single tool name
 * @param data.names Filter by specific tool names
 * @param data.toolIds Filter by specific tool IDs - accepts repeated params or comma-separated values
 * @param data.search Search tool names (case-insensitive partial match)
 * @param data.toolTypes Filter by tool type(s) - accepts repeated params or comma-separated values
 * @param data.excludeToolTypes Tool type(s) to exclude - accepts repeated params or comma-separated values
 * @param data.returnOnlyLettaTools Return only tools with tool_type starting with 'letta_'
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceListToolsSuspense = <
  TData = Common.ToolsServiceListToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListToolsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listTools({
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
      }) as TData,
    ...options,
  });
/**
 * List Composio Apps
 * Get a list of all Composio apps
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns AppModel Successful Response
 * @throws ApiError
 */
export const useToolsServiceListComposioAppsSuspense = <
  TData = Common.ToolsServiceListComposioAppsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioAppsKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listComposioApps({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Composio Actions By App
 * Get a list of all Composio actions for a specific app
 * @param data The data for the request.
 * @param data.composioAppName
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns ActionModel Successful Response
 * @throws ApiError
 */
export const useToolsServiceListComposioActionsByAppSuspense = <
  TData = Common.ToolsServiceListComposioActionsByAppDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioActionsByAppKeyFn(
      {
        composioAppName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listComposioActionsByApp({
        composioAppName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Mcp Servers
 * Get a list of all configured MCP servers
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceListMcpServersSuspense = <
  TData = Common.ToolsServiceListMcpServersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListMcpServersKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listMcpServers({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Mcp Tools By Server
 * Get a list of all tools for a specific MCP server
 * @param data The data for the request.
 * @param data.mcpServerName
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns MCPTool Successful Response
 * @throws ApiError
 */
export const useToolsServiceListMcpToolsByServerSuspense = <
  TData = Common.ToolsServiceListMcpToolsByServerDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListMcpToolsByServerKeyFn(
      {
        mcpServerName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listMcpToolsByServer({
        mcpServerName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Mcp Oauth Callback
 * Handle OAuth callback for MCP server authentication.
 * @param data The data for the request.
 * @param data.sessionId
 * @param data.code OAuth authorization code
 * @param data.state OAuth state parameter
 * @param data.error OAuth error
 * @param data.errorDescription OAuth error description
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceMcpOauthCallbackSuspense = <
  TData = Common.ToolsServiceMcpOauthCallbackDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceMcpOauthCallbackKeyFn(
      { code, error, errorDescription, sessionId, state },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.mcpOauthCallback({
        code,
        error,
        errorDescription,
        sessionId,
        state,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Count Sources
 * Count all data sources created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns number Successful Response
 * @throws ApiError
 */
export const useSourcesServiceCountSourcesSuspense = <
  TData = Common.SourcesServiceCountSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceCountSourcesKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.countSources({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Retrieve Source
 * Get all sources
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceRetrieveSourceSuspense = <
  TData = Common.SourcesServiceRetrieveSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceRetrieveSourceKeyFn(
      {
        sourceId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.retrieveSource({
        sourceId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Get Source Id By Name
 * Get a source by name
 * @param data The data for the request.
 * @param data.sourceName
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns string Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetSourceIdByNameSuspense = <
  TData = Common.SourcesServiceGetSourceIdByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn(
      {
        sourceName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getSourceIdByName({
        sourceName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Get Sources Metadata
 * Get aggregated metadata for all sources in an organization.
 *
 * Returns structured metadata including:
 * - Total number of sources
 * - Total number of files across all sources
 * - Total size of all files
 * - Per-source breakdown with file details (file_name, file_size per file) if include_detailed_per_source_metadata is True
 * @param data The data for the request.
 * @param data.includeDetailedPerSourceMetadata
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns OrganizationSourcesStats Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetSourcesMetadataSuspense = <
  TData = Common.SourcesServiceGetSourcesMetadataDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourcesMetadataKeyFn(
      {
        includeDetailedPerSourceMetadata,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getSourcesMetadata({
        includeDetailedPerSourceMetadata,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * List Sources
 * List all data sources created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceListSourcesSuspense = <
  TData = Common.SourcesServiceListSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listSources({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Get Agents For Source
 * Get all agent IDs that have the specified source attached.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns string Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetAgentsForSourceSuspense = <
  TData = Common.SourcesServiceGetAgentsForSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetAgentsForSourceKeyFn(
      {
        sourceId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getAgentsForSource({
        sourceId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * List Source Passages
 * List all passages associated with a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.after Message after which to retrieve the returned messages.
 * @param data.before Message before which to retrieve the returned messages.
 * @param data.limit Maximum number of messages to retrieve.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useSourcesServiceListSourcePassagesSuspense = <
  TData = Common.SourcesServiceListSourcePassagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listSourcePassages({
        after,
        before,
        limit,
        sourceId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * List Source Files
 * List paginated files associated with a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.limit Number of files to return
 * @param data.after Pagination cursor to fetch the next set of results
 * @param data.includeContent Whether to include full file content
 * @param data.checkStatusUpdates Whether to check and update file processing status (from the vector db service). If False, will not fetch and update the status, which may lead to performance gains.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useSourcesServiceListSourceFilesSuspense = <
  TData = Common.SourcesServiceListSourceFilesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourceFilesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listSourceFiles({
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
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Get File Metadata
 * Retrieve metadata for a specific file by its ID.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.fileId
 * @param data.includeContent Whether to include full file content
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetFileMetadataSuspense = <
  TData = Common.SourcesServiceGetFileMetadataDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetFileMetadataKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getFileMetadata({
        fileId,
        includeContent,
        sourceId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Count Folders
 * Count all data folders created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns number Successful Response
 * @throws ApiError
 */
export const useFoldersServiceCountFoldersSuspense = <
  TData = Common.FoldersServiceCountFoldersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceCountFoldersKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      FoldersService.countFolders({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Folder
 * Get a folder by ID
 * @param data The data for the request.
 * @param data.folderId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Folder Successful Response
 * @throws ApiError
 */
export const useFoldersServiceRetrieveFolderSuspense = <
  TData = Common.FoldersServiceRetrieveFolderDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceRetrieveFolderKeyFn(
      {
        folderId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      FoldersService.retrieveFolder({
        folderId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Get Folder By Name
 * **Deprecated**: Please use the list endpoint `GET /v1/folders?name=` instead.
 *
 *
 * Get a folder by name.
 * @param data The data for the request.
 * @param data.folderName
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns string Successful Response
 * @throws ApiError
 */
export const useFoldersServiceGetFolderByNameSuspense = <
  TData = Common.FoldersServiceGetFolderByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceGetFolderByNameKeyFn(
      {
        folderName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      FoldersService.getFolderByName({
        folderName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Metadata
 * Get aggregated metadata for all folders in an organization.
 *
 * Returns structured metadata including:
 * - Total number of folders
 * - Total number of files across all folders
 * - Total size of all files
 * - Per-source breakdown with file details (file_name, file_size per file) if include_detailed_per_source_metadata is True
 * @param data The data for the request.
 * @param data.includeDetailedPerSourceMetadata
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns OrganizationSourcesStats Successful Response
 * @throws ApiError
 */
export const useFoldersServiceRetrieveMetadataSuspense = <
  TData = Common.FoldersServiceRetrieveMetadataDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceRetrieveMetadataKeyFn(
      {
        includeDetailedPerSourceMetadata,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      FoldersService.retrieveMetadata({
        includeDetailedPerSourceMetadata,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Folders
 * List all data folders created by a user.
 * @param data The data for the request.
 * @param data.before Folder ID cursor for pagination. Returns folders that come before this folder ID in the specified sort order
 * @param data.after Folder ID cursor for pagination. Returns folders that come after this folder ID in the specified sort order
 * @param data.limit Maximum number of folders to return
 * @param data.order Sort order for folders by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.name Folder name to filter by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Folder Successful Response
 * @throws ApiError
 */
export const useFoldersServiceListFoldersSuspense = <
  TData = Common.FoldersServiceListFoldersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceListFoldersKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      FoldersService.listFolders({
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
      }) as TData,
    ...options,
  });
/**
 * List Agents For Folder
 * Get all agent IDs that have the specified folder attached.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.before Agent ID cursor for pagination. Returns agents that come before this agent ID in the specified sort order
 * @param data.after Agent ID cursor for pagination. Returns agents that come after this agent ID in the specified sort order
 * @param data.limit Maximum number of agents to return
 * @param data.order Sort order for agents by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns string Successful Response
 * @throws ApiError
 */
export const useFoldersServiceListAgentsForFolderSuspense = <
  TData = Common.FoldersServiceListAgentsForFolderDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceListAgentsForFolderKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      FoldersService.listAgentsForFolder({
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
      }) as TData,
    ...options,
  });
/**
 * List Folder Passages
 * List all passages associated with a data folder.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.before Passage ID cursor for pagination. Returns passages that come before this passage ID in the specified sort order
 * @param data.after Passage ID cursor for pagination. Returns passages that come after this passage ID in the specified sort order
 * @param data.limit Maximum number of passages to return
 * @param data.order Sort order for passages by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useFoldersServiceListFolderPassagesSuspense = <
  TData = Common.FoldersServiceListFolderPassagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceListFolderPassagesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      FoldersService.listFolderPassages({
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
      }) as TData,
    ...options,
  });
/**
 * List Folder Files
 * List paginated files associated with a data folder.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.before File ID cursor for pagination. Returns files that come before this file ID in the specified sort order
 * @param data.after File ID cursor for pagination. Returns files that come after this file ID in the specified sort order
 * @param data.limit Maximum number of files to return
 * @param data.order Sort order for files by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.includeContent Whether to include full file content
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useFoldersServiceListFolderFilesSuspense = <
  TData = Common.FoldersServiceListFolderFilesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceListFolderFilesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      FoldersService.listFolderFiles({
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
      }) as TData,
    ...options,
  });
/**
 * List Agents
 * Get a list of all agents.
 * @param data The data for the request.
 * @param data.name Name of the agent
 * @param data.tags List of tags to filter agents by
 * @param data.matchAllTags If True, only returns agents that match ALL given tags. Otherwise, return agents that have ANY of the passed-in tags.
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Limit for pagination
 * @param data.queryText Search agents by name
 * @param data.projectId Search agents by project ID - this will default to your default project on cloud
 * @param data.templateId Search agents by template ID
 * @param data.baseTemplateId Search agents by base template ID
 * @param data.identityId Search agents by identity ID
 * @param data.identifierKeys Search agents by identifier keys
 * @param data.includeRelationships Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. If not provided, all relationships are loaded by default. Using this can optimize performance by reducing unnecessary joins.
 * @param data.order Sort order for agents by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.ascending Whether to sort agents oldest to newest (True) or newest to oldest (False, default)
 * @param data.sortBy Field to sort by. Options: 'created_at' (default), 'last_run_completion'
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentsSuspense = <
  TData = Common.AgentsServiceListAgentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgents({
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
      }) as TData,
    ...options,
  });
/**
 * Count Agents
 * Get the total number of agents.
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns number Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCountAgentsSuspense = <
  TData = Common.AgentsServiceCountAgentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceCountAgentsKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.countAgents({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Export Agent
 * Export the serialized JSON representation of an agent, formatted with indentation.
 *
 * Supports two export formats:
 * - Legacy format (use_legacy_format=true): Single agent with inline tools/blocks
 * - New format (default): Multi-entity format with separate agents, tools, blocks, files, etc.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.maxSteps
 * @param data.useLegacyFormat If true, exports using the legacy single-agent format (v1). If false, exports using the new multi-entity format (v2).
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @param data.requestBody
 * @returns string Successful Response
 * @throws ApiError
 */
export const useAgentsServiceExportAgentSuspense = <
  TData = Common.AgentsServiceExportAgentDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceExportAgentKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      AgentsService.exportAgent({
        agentId,
        maxSteps,
        requestBody,
        useLegacyFormat,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Agent Context Window
 * Retrieve the context window of a specific agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns ContextWindowOverview Successful Response
 * @throws ApiError
 */
export const useAgentsServiceRetrieveAgentContextWindowSuspense = <
  TData = Common.AgentsServiceRetrieveAgentContextWindowDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentContextWindowKeyFn(
      {
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgentContextWindow({
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Agent
 * Get the state of the agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.includeRelationships Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. If not provided, all relationships are loaded by default. Using this can optimize performance by reducing unnecessary joins.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceRetrieveAgentSuspense = <
  TData = Common.AgentsServiceRetrieveAgentDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentKeyFn(
      {
        agentId,
        includeRelationships,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgent({
        agentId,
        includeRelationships,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Agent Tools
 * Get tools from an existing agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentToolsSuspense = <
  TData = Common.AgentsServiceListAgentToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentToolsKeyFn(
      {
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentTools({
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Agent Sources
 * Get the sources associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentSourcesSuspense = <
  TData = Common.AgentsServiceListAgentSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentSourcesKeyFn(
      {
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentSources({
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Agent Folders
 * Get the folders associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentFoldersSuspense = <
  TData = Common.AgentsServiceListAgentFoldersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentFoldersKeyFn(
      {
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentFolders({
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Agent Files
 * Get the files attached to an agent with their open/closed status (paginated).
 * @param data The data for the request.
 * @param data.agentId
 * @param data.cursor Pagination cursor from previous response
 * @param data.limit Number of items to return (1-100)
 * @param data.isOpen Filter by open status (true for open files, false for closed files)
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns PaginatedAgentFiles Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentFilesSuspense = <
  TData = Common.AgentsServiceListAgentFilesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentFilesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentFiles({
        agentId,
        cursor,
        isOpen,
        limit,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Agent Memory
 * Retrieve the memory state of a specific agent.
 * This endpoint fetches the current memory state of the agent identified by the user ID and agent ID.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Memory Successful Response
 * @throws ApiError
 */
export const useAgentsServiceRetrieveAgentMemorySuspense = <
  TData = Common.AgentsServiceRetrieveAgentMemoryDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentMemoryKeyFn(
      {
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgentMemory({
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Block
 * Retrieve a core memory block from an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockLabel
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useAgentsServiceRetrieveCoreMemoryBlockSuspense = <
  TData = Common.AgentsServiceRetrieveCoreMemoryBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveCoreMemoryBlockKeyFn(
      {
        agentId,
        blockLabel,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveCoreMemoryBlock({
        agentId,
        blockLabel,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Blocks
 * Retrieve the core memory blocks of a specific agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListCoreMemoryBlocksSuspense = <
  TData = Common.AgentsServiceListCoreMemoryBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListCoreMemoryBlocksKeyFn(
      {
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listCoreMemoryBlocks({
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Passages
 * Retrieve the memories in an agent's archival memory store (paginated query).
 * @param data The data for the request.
 * @param data.agentId
 * @param data.after Unique ID of the memory to start the query range at.
 * @param data.before Unique ID of the memory to end the query range at.
 * @param data.limit How many results to include in the response.
 * @param data.search Search passages by text
 * @param data.ascending Whether to sort passages oldest to newest (True, default) or newest to oldest (False)
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListPassagesSuspense = <
  TData = Common.AgentsServiceListPassagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListPassagesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listPassages({
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
      }) as TData,
    ...options,
  });
/**
 * Search Archival Memory
 * Search archival memory using semantic (embedding-based) search with optional temporal filtering.
 *
 * This endpoint allows manual triggering of archival memory searches, enabling users to query
 * an agent's archival memory store directly via the API. The search uses the same functionality
 * as the agent's archival_memory_search tool but is accessible for external API usage.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.query String to search for using semantic similarity
 * @param data.tags Optional list of tags to filter search results
 * @param data.tagMatchMode How to match tags - 'any' to match passages with any of the tags, 'all' to match only passages with all tags
 * @param data.topK Maximum number of results to return. Uses system default if not specified
 * @param data.startDatetime Filter results to passages created after this datetime
 * @param data.endDatetime Filter results to passages created before this datetime
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns ArchivalMemorySearchResponse Successful Response
 * @throws ApiError
 */
export const useAgentsServiceSearchArchivalMemorySuspense = <
  TData = Common.AgentsServiceSearchArchivalMemoryDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceSearchArchivalMemoryKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      AgentsService.searchArchivalMemory({
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
      }) as TData,
    ...options,
  });
/**
 * List Messages
 * Retrieve message history for an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.after Message after which to retrieve the returned messages.
 * @param data.before Message before which to retrieve the returned messages.
 * @param data.limit Maximum number of messages to retrieve.
 * @param data.groupId Group ID to filter messages by.
 * @param data.useAssistantMessage Whether to use assistant messages
 * @param data.assistantMessageToolName The name of the designated message tool.
 * @param data.assistantMessageToolKwarg The name of the message argument.
 * @param data.includeErr Whether to include error messages and error statuses. For debugging purposes only.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns LettaMessageUnion Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListMessagesSuspense = <
  TData = Common.AgentsServiceListMessagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListMessagesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listMessages({
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
      }) as TData,
    ...options,
  });
/**
 * List Agent Groups
 * Lists the groups for an agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.managerType Manager type to filter groups by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentGroupsSuspense = <
  TData = Common.AgentsServiceListAgentGroupsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentGroupsKeyFn(
      {
        agentId,
        managerType,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentGroups({
        agentId,
        managerType,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Groups
 * Fetch all multi-agent groups matching query.
 * @param data The data for the request.
 * @param data.managerType Search groups by manager type
 * @param data.before Group ID cursor for pagination. Returns groups that come before this group ID in the specified sort order
 * @param data.after Group ID cursor for pagination. Returns groups that come after this group ID in the specified sort order
 * @param data.limit Maximum number of groups to return
 * @param data.order Sort order for groups by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.projectId Search groups by project id
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useGroupsServiceListGroupsSuspense = <
  TData = Common.GroupsServiceListGroupsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceListGroupsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      GroupsService.listGroups({
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
      }) as TData,
    ...options,
  });
/**
 * Count Groups
 * Get the count of all groups associated with a given user.
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns number Successful Response
 * @throws ApiError
 */
export const useGroupsServiceCountGroupsSuspense = <
  TData = Common.GroupsServiceCountGroupsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceCountGroupsKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      GroupsService.countGroups({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Group
 * Retrieve the group by id.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useGroupsServiceRetrieveGroupSuspense = <
  TData = Common.GroupsServiceRetrieveGroupDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceRetrieveGroupKeyFn(
      {
        groupId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      GroupsService.retrieveGroup({
        groupId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Group Messages
 * Retrieve message history for an agent.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.before Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order
 * @param data.after Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order
 * @param data.limit Maximum number of messages to retrieve
 * @param data.order Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.useAssistantMessage Whether to use assistant messages
 * @param data.assistantMessageToolName The name of the designated message tool.
 * @param data.assistantMessageToolKwarg The name of the message argument.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns LettaMessageUnion Successful Response
 * @throws ApiError
 */
export const useGroupsServiceListGroupMessagesSuspense = <
  TData = Common.GroupsServiceListGroupMessagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceListGroupMessagesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      GroupsService.listGroupMessages({
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
      }) as TData,
    ...options,
  });
/**
 * List Identities
 * Get a list of all identities in the database
 * @param data The data for the request.
 * @param data.name
 * @param data.projectId
 * @param data.identifierKey
 * @param data.identityType
 * @param data.before Identity ID cursor for pagination. Returns identities that come before this identity ID in the specified sort order
 * @param data.after Identity ID cursor for pagination. Returns identities that come after this identity ID in the specified sort order
 * @param data.limit Maximum number of identities to return
 * @param data.order Sort order for identities by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Identity Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceListIdentitiesSuspense = <
  TData = Common.IdentitiesServiceListIdentitiesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceListIdentitiesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      IdentitiesService.listIdentities({
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
      }) as TData,
    ...options,
  });
/**
 * Count Identities
 * Get count of all identities for a user
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns number Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceCountIdentitiesSuspense = <
  TData = Common.IdentitiesServiceCountIdentitiesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceCountIdentitiesKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      IdentitiesService.countIdentities({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Identity
 * @param data The data for the request.
 * @param data.identityId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Identity Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceRetrieveIdentitySuspense = <
  TData = Common.IdentitiesServiceRetrieveIdentityDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceRetrieveIdentityKeyFn(
      {
        identityId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      IdentitiesService.retrieveIdentity({
        identityId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Agents For Identity
 * Get all agents associated with the specified identity.
 * @param data The data for the request.
 * @param data.identityId
 * @param data.before Agent ID cursor for pagination. Returns agents that come before this agent ID in the specified sort order
 * @param data.after Agent ID cursor for pagination. Returns agents that come after this agent ID in the specified sort order
 * @param data.limit Maximum number of agents to return
 * @param data.order Sort order for agents by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceListAgentsForIdentitySuspense = <
  TData = Common.IdentitiesServiceListAgentsForIdentityDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceListAgentsForIdentityKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      IdentitiesService.listAgentsForIdentity({
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
      }) as TData,
    ...options,
  });
/**
 * List Blocks For Identity
 * Get all blocks associated with the specified identity.
 * @param data The data for the request.
 * @param data.identityId
 * @param data.before Block ID cursor for pagination. Returns blocks that come before this block ID in the specified sort order
 * @param data.after Block ID cursor for pagination. Returns blocks that come after this block ID in the specified sort order
 * @param data.limit Maximum number of blocks to return
 * @param data.order Sort order for blocks by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceListBlocksForIdentitySuspense = <
  TData = Common.IdentitiesServiceListBlocksForIdentityDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceListBlocksForIdentityKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      IdentitiesService.listBlocksForIdentity({
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
      }) as TData,
    ...options,
  });
/**
 * List Deployment Entities
 * List all entities (blocks, agents, groups) with the specified deployment_id.
 * Optionally filter by entity types.
 * @param data The data for the request.
 * @param data.deploymentId
 * @param data.entityTypes Filter by entity types (block, agent, group)
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns ListDeploymentEntitiesResponse Successful Response
 * @throws ApiError
 */
export const useInternalTemplatesServiceListDeploymentEntitiesSuspense = <
  TData = Common.InternalTemplatesServiceListDeploymentEntitiesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseInternalTemplatesServiceListDeploymentEntitiesKeyFn(
      {
        deploymentId,
        entityTypes,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      InternalTemplatesService.listDeploymentEntities({
        deploymentId,
        entityTypes,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Llm Models
 * List available LLM models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.providerCategory
 * @param data.providerName
 * @param data.providerType
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const useModelsServiceListModelsSuspense = <
  TData = Common.ModelsServiceListModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListModelsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      ModelsService.listModels({
        providerCategory,
        providerName,
        providerType,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Embedding Models
 * List available embedding models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const useModelsServiceListEmbeddingModelsSuspense = <
  TData = Common.ModelsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      ModelsService.listEmbeddingModels({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Llm Models
 * List available LLM models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.providerCategory
 * @param data.providerName
 * @param data.providerType
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const useLlmsServiceListModelsSuspense = <
  TData = Common.LlmsServiceListModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListModelsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      LlmsService.listModels({
        providerCategory,
        providerName,
        providerType,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Embedding Models
 * List available embedding models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const useLlmsServiceListEmbeddingModelsSuspense = <
  TData = Common.LlmsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      LlmsService.listEmbeddingModels({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Blocks
 * @param data The data for the request.
 * @param data.label Labels to include (e.g. human, persona)
 * @param data.templatesOnly Whether to include only templates
 * @param data.name Name of the block
 * @param data.identityId Search agents by identifier id
 * @param data.identifierKeys Search agents by identifier keys
 * @param data.projectId Search blocks by project id
 * @param data.limit Number of blocks to return
 * @param data.before Block ID cursor for pagination. Returns blocks that come before this block ID in the specified sort order
 * @param data.after Block ID cursor for pagination. Returns blocks that come after this block ID in the specified sort order
 * @param data.order Sort order for blocks by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.labelSearch Search blocks by label. If provided, returns blocks that match this label. This is a full-text search on labels.
 * @param data.descriptionSearch Search blocks by description. If provided, returns blocks that match this description. This is a full-text search on block descriptions.
 * @param data.valueSearch Search blocks by value. If provided, returns blocks that match this value.
 * @param data.connectedToAgentsCountGt Filter blocks by the number of connected agents. If provided, returns blocks that have more than this number of connected agents.
 * @param data.connectedToAgentsCountLt Filter blocks by the number of connected agents. If provided, returns blocks that have less than this number of connected agents.
 * @param data.connectedToAgentsCountEq Filter blocks by the exact number of connected agents. If provided, returns blocks that have exactly this number of connected agents.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceListBlocksSuspense = <
  TData = Common.BlocksServiceListBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceListBlocksKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      BlocksService.listBlocks({
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
      }) as TData,
    ...options,
  });
/**
 * Count Blocks
 * Count all blocks created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns number Successful Response
 * @throws ApiError
 */
export const useBlocksServiceCountBlocksSuspense = <
  TData = Common.BlocksServiceCountBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceCountBlocksKeyFn(
      {
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      BlocksService.countBlocks({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceRetrieveBlockSuspense = <
  TData = Common.BlocksServiceRetrieveBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceRetrieveBlockKeyFn(
      {
        blockId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      BlocksService.retrieveBlock({
        blockId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Agents For Block
 * Retrieves all agents associated with the specified block.
 * Raises a 404 if the block does not exist.
 * @param data The data for the request.
 * @param data.blockId
 * @param data.before Agent ID cursor for pagination. Returns agents that come before this agent ID in the specified sort order
 * @param data.after Agent ID cursor for pagination. Returns agents that come after this agent ID in the specified sort order
 * @param data.limit Maximum number of agents to return
 * @param data.order Sort order for agents by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.includeRelationships Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. If not provided, all relationships are loaded by default. Using this can optimize performance by reducing unnecessary joins.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useBlocksServiceListAgentsForBlockSuspense = <
  TData = Common.BlocksServiceListAgentsForBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceListAgentsForBlockKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      BlocksService.listAgentsForBlock({
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
      }) as TData,
    ...options,
  });
/**
 * List Jobs
 * List all jobs.
 * @param data The data for the request.
 * @param data.sourceId Only list jobs associated with the source.
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Limit for pagination
 * @param data.active Filter for active jobs.
 * @param data.ascending Whether to sort jobs oldest to newest (True, default) or newest to oldest (False)
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceListJobsSuspense = <
  TData = Common.JobsServiceListJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    active,
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
    active?: boolean;
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsKeyFn(
      {
        active,
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
      queryKey,
    ),
    queryFn: () =>
      JobsService.listJobs({
        active,
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
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * List Active Jobs
 * List all active jobs.
 * @param data The data for the request.
 * @param data.sourceId Only list jobs associated with the source.
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Limit for pagination
 * @param data.ascending Whether to sort jobs oldest to newest (True, default) or newest to oldest (False)
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceListActiveJobsSuspense = <
  TData = Common.JobsServiceListActiveJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      JobsService.listActiveJobs({
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
      }) as TData,
    ...options,
  });
/**
 * Retrieve Job
 * Get the status of a job.
 * @param data The data for the request.
 * @param data.jobId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceRetrieveJobSuspense = <
  TData = Common.JobsServiceRetrieveJobDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceRetrieveJobKeyFn(
      {
        jobId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      JobsService.retrieveJob({
        jobId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Check Health
 * @returns Health Successful Response
 * @throws ApiError
 */
export const useHealthServiceCheckHealthSuspense = <
  TData = Common.HealthServiceCheckHealthDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseHealthServiceCheckHealthKeyFn(queryKey),
    queryFn: () => HealthService.checkHealth() as TData,
    ...options,
  });
/**
 * List Sandbox Configs
 * @param data The data for the request.
 * @param data.limit Number of results to return
 * @param data.after Pagination cursor to fetch the next set of results
 * @param data.sandboxType Filter for this specific sandbox type
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns SandboxConfig Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetSuspense =
  <
    TData = Common.SandboxConfigServiceListSandboxConfigsV1SandboxConfigGetDefaultResponse,
    TError = unknown,
    TQueryKey extends Array<unknown> = unknown[],
  >(
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
    queryKey?: TQueryKey,
    options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
  ) =>
    useSuspenseQuery<TData, TError>({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKeyFn(
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
          queryKey,
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxConfigsV1SandboxConfigGet({
          after,
          limit,
          sandboxType,
          userAgent,
          userId,
          xExperimentalLettaV1Agent,
          xExperimentalMessageAsync,
          xProjectId,
        }) as TData,
      ...options,
    });
/**
 * List Sandbox Env Vars
 * @param data The data for the request.
 * @param data.sandboxConfigId
 * @param data.limit Number of results to return
 * @param data.after Pagination cursor to fetch the next set of results
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns SandboxEnvironmentVariable Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetSuspense =
  <
    TData = Common.SandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetDefaultResponse,
    TError = unknown,
    TQueryKey extends Array<unknown> = unknown[],
  >(
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
    queryKey?: TQueryKey,
    options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
  ) =>
    useSuspenseQuery<TData, TError>({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKeyFn(
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
          queryKey,
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
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
        ) as TData,
      ...options,
    });
/**
 * List Providers
 * Get a list of all custom providers.
 * @param data The data for the request.
 * @param data.before Provider ID cursor for pagination. Returns providers that come before this provider ID in the specified sort order
 * @param data.after Provider ID cursor for pagination. Returns providers that come after this provider ID in the specified sort order
 * @param data.limit Maximum number of providers to return
 * @param data.order Sort order for providers by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.name Filter providers by name
 * @param data.providerType Filter providers by type
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Provider Successful Response
 * @throws ApiError
 */
export const useProvidersServiceListProvidersSuspense = <
  TData = Common.ProvidersServiceListProvidersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseProvidersServiceListProvidersKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      ProvidersService.listProviders({
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
      }) as TData,
    ...options,
  });
/**
 * Retrieve Provider
 * Get a provider by ID.
 * @param data The data for the request.
 * @param data.providerId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Provider Successful Response
 * @throws ApiError
 */
export const useProvidersServiceRetrieveProviderSuspense = <
  TData = Common.ProvidersServiceRetrieveProviderDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseProvidersServiceRetrieveProviderKeyFn(
      {
        providerId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      ProvidersService.retrieveProvider({
        providerId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Runs
 * List all runs.
 * @param data The data for the request.
 * @param data.agentId The unique identifier of the agent associated with the run.
 * @param data.agentIds (DEPRECATED) The unique identifiers of the agents associated with the run.
 * @param data.background If True, filters for runs that were created in background mode.
 * @param data.stopReason Filter runs by stop reason.
 * @param data.after Cursor for pagination
 * @param data.before Cursor for pagination
 * @param data.limit Maximum number of runs to return
 * @param data.active Filter for active runs.
 * @param data.ascending Whether to sort agents oldest to newest (True) or newest to oldest (False, default)
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceListRunsSuspense = <
  TData = Common.RunsServiceListRunsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    active,
    after,
    agentId,
    agentIds,
    ascending,
    background,
    before,
    limit,
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
    stopReason?: StopReasonType;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunsKeyFn(
      {
        active,
        after,
        agentId,
        agentIds,
        ascending,
        background,
        before,
        limit,
        stopReason,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      RunsService.listRuns({
        active,
        after,
        agentId,
        agentIds,
        ascending,
        background,
        before,
        limit,
        stopReason,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * List Active Runs
 * List all active runs.
 * @param data The data for the request.
 * @param data.agentId The unique identifier of the agent associated with the run.
 * @param data.background If True, filters for runs that were created in background mode.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceListActiveRunsSuspense = <
  TData = Common.RunsServiceListActiveRunsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListActiveRunsKeyFn(
      {
        agentId,
        background,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      RunsService.listActiveRuns({
        agentId,
        background,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Run
 * Get the status of a run.
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceRetrieveRunSuspense = <
  TData = Common.RunsServiceRetrieveRunDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseRunsServiceRetrieveRunKeyFn(
      {
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      RunsService.retrieveRun({
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Run Messages
 * Get response messages associated with a run.
 * @param data The data for the request.
 * @param data.runId
 * @param data.before Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order
 * @param data.after Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order
 * @param data.limit Maximum number of messages to return
 * @param data.order Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns LettaMessageUnion Successful Response
 * @throws ApiError
 */
export const useRunsServiceListRunMessagesSuspense = <
  TData = Common.RunsServiceListRunMessagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    after,
    before,
    limit,
    order,
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
    runId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunMessagesKeyFn(
      {
        after,
        before,
        limit,
        order,
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      RunsService.listRunMessages({
        after,
        before,
        limit,
        order,
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Run Usage
 * Get usage statistics for a run.
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns UsageStatistics Successful Response
 * @throws ApiError
 */
export const useRunsServiceRetrieveRunUsageSuspense = <
  TData = Common.RunsServiceRetrieveRunUsageDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseRunsServiceRetrieveRunUsageKeyFn(
      {
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      RunsService.retrieveRunUsage({
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Run Steps
 * Get messages associated with a run with filtering options.
 *
 * Args:
 * run_id: ID of the run
 * before: A cursor for use in pagination. `before` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with obj_foo, your subsequent call can include before=obj_foo in order to fetch the previous page of the list.
 * after: A cursor for use in pagination. `after` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with obj_foo, your subsequent call can include after=obj_foo in order to fetch the next page of the list.
 * limit: Maximum number of steps to return
 * order: Sort order by the created_at timestamp of the objects. asc for ascending order and desc for descending order.
 *
 * Returns:
 * A list of steps associated with the run.
 * @param data The data for the request.
 * @param data.runId
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Maximum number of messages to return
 * @param data.order Sort order by the created_at timestamp of the objects. asc for ascending order and desc for descending order.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Step Successful Response
 * @throws ApiError
 */
export const useRunsServiceListRunStepsSuspense = <
  TData = Common.RunsServiceListRunStepsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    after,
    before,
    limit,
    order,
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
    order?: string;
    runId: string;
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunStepsKeyFn(
      {
        after,
        before,
        limit,
        order,
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      RunsService.listRunSteps({
        after,
        before,
        limit,
        order,
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Steps
 * List steps with optional pagination and date filters.
 * @param data The data for the request.
 * @param data.before Return steps before this step ID
 * @param data.after Return steps after this step ID
 * @param data.limit Maximum number of steps to return
 * @param data.order Sort order for steps by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.startDate Return steps after this ISO datetime (e.g. "2025-01-29T15:01:19-08:00")
 * @param data.endDate Return steps before this ISO datetime (e.g. "2025-01-29T15:01:19-08:00")
 * @param data.model Filter by the name of the model used for the step
 * @param data.agentId Filter by the ID of the agent that performed the step
 * @param data.traceIds Filter by trace ids returned by the server
 * @param data.feedback Filter by feedback
 * @param data.hasFeedback Filter by whether steps have feedback (true) or not (false)
 * @param data.tags Filter by tags
 * @param data.projectId Filter by the project ID that is associated with the step (cloud only).
 * @param data.xProject Filter by project slug to associate with the group (cloud only).
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Step Successful Response
 * @throws ApiError
 */
export const useStepsServiceListStepsSuspense = <
  TData = Common.StepsServiceListStepsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseStepsServiceListStepsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      StepsService.listSteps({
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
      }) as TData,
    ...options,
  });
/**
 * Retrieve Step
 * Get a step by ID.
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Step Successful Response
 * @throws ApiError
 */
export const useStepsServiceRetrieveStepSuspense = <
  TData = Common.StepsServiceRetrieveStepDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseStepsServiceRetrieveStepKeyFn(
      {
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      StepsService.retrieveStep({
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Metrics For Step
 * Get step metrics by step ID.
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns StepMetrics Successful Response
 * @throws ApiError
 */
export const useStepsServiceRetrieveMetricsForStepSuspense = <
  TData = Common.StepsServiceRetrieveMetricsForStepDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseStepsServiceRetrieveMetricsForStepKeyFn(
      {
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      StepsService.retrieveMetricsForStep({
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Retrieve Trace For Step
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useStepsServiceRetrieveTraceForStepSuspense = <
  TData = Common.StepsServiceRetrieveTraceForStepDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseStepsServiceRetrieveTraceForStepKeyFn(
      {
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      StepsService.retrieveTraceForStep({
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Messages For Step
 * List messages for a given step.
 * @param data The data for the request.
 * @param data.stepId
 * @param data.before Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order
 * @param data.after Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order
 * @param data.limit Maximum number of messages to return
 * @param data.order Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Sort by field
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useStepsServiceListMessagesForStepSuspense = <
  TData = Common.StepsServiceListMessagesForStepDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseStepsServiceListMessagesForStepKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      StepsService.listMessagesForStep({
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
      }) as TData,
    ...options,
  });
/**
 * List Tags
 * Get the list of all agent tags that have been created.
 * @param data The data for the request.
 * @param data.before Tag cursor for pagination. Returns tags that come before this tag in the specified sort order
 * @param data.after Tag cursor for pagination. Returns tags that come after this tag in the specified sort order
 * @param data.limit Maximum number of tags to return
 * @param data.order Sort order for tags. 'asc' for alphabetical order, 'desc' for reverse alphabetical order
 * @param data.orderBy Field to sort by
 * @param data.queryText Filter tags by text search. Deprecated, please use name field instead
 * @param data.name Filter tags by name
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns string Successful Response
 * @throws ApiError
 */
export const useTagServiceListTagsSuspense = <
  TData = Common.TagServiceListTagsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseTagServiceListTagsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      TagService.listTags({
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
      }) as TData,
    ...options,
  });
/**
 * List Tags
 * Get the list of all agent tags that have been created.
 * @param data The data for the request.
 * @param data.before Tag cursor for pagination. Returns tags that come before this tag in the specified sort order
 * @param data.after Tag cursor for pagination. Returns tags that come after this tag in the specified sort order
 * @param data.limit Maximum number of tags to return
 * @param data.order Sort order for tags. 'asc' for alphabetical order, 'desc' for reverse alphabetical order
 * @param data.orderBy Field to sort by
 * @param data.queryText Filter tags by text search. Deprecated, please use name field instead
 * @param data.name Filter tags by name
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns string Successful Response
 * @throws ApiError
 */
export const useAdminServiceListTagsSuspense = <
  TData = Common.AdminServiceListTagsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListTagsKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      AdminService.listTags({
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
      }) as TData,
    ...options,
  });
/**
 * List Users
 * Get a list of all users in the database
 * @param data The data for the request.
 * @param data.after
 * @param data.limit
 * @returns User Successful Response
 * @throws ApiError
 */
export const useAdminServiceListUsersSuspense = <
  TData = Common.AdminServiceListUsersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListUsersKeyFn({ after, limit }, queryKey),
    queryFn: () => AdminService.listUsers({ after, limit }) as TData,
    ...options,
  });
/**
 * Get All Orgs
 * Get a list of all orgs in the database
 * @param data The data for the request.
 * @param data.after
 * @param data.limit
 * @returns Organization Successful Response
 * @throws ApiError
 */
export const useAdminServiceListOrgsSuspense = <
  TData = Common.AdminServiceListOrgsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListOrgsKeyFn({ after, limit }, queryKey),
    queryFn: () => AdminService.listOrgs({ after, limit }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Retrieve Provider Trace
 * **DEPRECATED**: Use `GET /steps/{step_id}/trace` instead.
 *
 * Retrieve provider trace by step ID.
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useTelemetryServiceRetrieveProviderTraceSuspense = <
  TData = Common.TelemetryServiceRetrieveProviderTraceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseTelemetryServiceRetrieveProviderTraceKeyFn(
      {
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      TelemetryService.retrieveProviderTrace({
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Batches
 * List all batch runs.
 * @param data The data for the request.
 * @param data.before Job ID cursor for pagination. Returns jobs that come before this job ID in the specified sort order
 * @param data.after Job ID cursor for pagination. Returns jobs that come after this job ID in the specified sort order
 * @param data.limit Maximum number of jobs to return
 * @param data.order Sort order for jobs by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const useMessagesServiceListBatchesSuspense = <
  TData = Common.MessagesServiceListBatchesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseMessagesServiceListBatchesKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      MessagesService.listBatches({
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
      }) as TData,
    ...options,
  });
/**
 * Retrieve Batch
 * Retrieve the status and details of a batch run.
 * @param data The data for the request.
 * @param data.batchId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const useMessagesServiceRetrieveBatchSuspense = <
  TData = Common.MessagesServiceRetrieveBatchDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseMessagesServiceRetrieveBatchKeyFn(
      {
        batchId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      MessagesService.retrieveBatch({
        batchId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Messages For Batch
 * Get response messages for a specific batch job.
 * @param data The data for the request.
 * @param data.batchId
 * @param data.before Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order
 * @param data.after Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order
 * @param data.limit Maximum number of messages to return
 * @param data.order Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.agentId Filter messages by agent ID
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns LettaBatchMessages Successful Response
 * @throws ApiError
 */
export const useMessagesServiceListMessagesForBatchSuspense = <
  TData = Common.MessagesServiceListMessagesForBatchDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseMessagesServiceListMessagesForBatchKeyFn(
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
      queryKey,
    ),
    queryFn: () =>
      MessagesService.listMessagesForBatch({
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
      }) as TData,
    ...options,
  });
/**
 * Get Embeddings Total Storage Size
 * Get the total size of all embeddings in the database for a user in the storage unit given.
 * @param data The data for the request.
 * @param data.storageUnit
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns number Successful Response
 * @throws ApiError
 */
export const useEmbeddingsServiceGetTotalStorageSizeSuspense = <
  TData = Common.EmbeddingsServiceGetTotalStorageSizeDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseEmbeddingsServiceGetTotalStorageSizeKeyFn(
      {
        storageUnit,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      EmbeddingsService.getTotalStorageSize({
        storageUnit,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Users
 * Get a list of all users in the database
 * @param data The data for the request.
 * @param data.after
 * @param data.limit
 * @returns User Successful Response
 * @throws ApiError
 */
export const useUsersServiceListUsersSuspense = <
  TData = Common.UsersServiceListUsersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseUsersServiceListUsersKeyFn({ after, limit }, queryKey),
    queryFn: () => UsersService.listUsers({ after, limit }) as TData,
    ...options,
  });
/**
 * Get All Orgs
 * Get a list of all orgs in the database
 * @param data The data for the request.
 * @param data.after
 * @param data.limit
 * @returns Organization Successful Response
 * @throws ApiError
 */
export const useOrganizationServiceListOrgsSuspense = <
  TData = Common.OrganizationServiceListOrgsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseOrganizationServiceListOrgsKeyFn(
      { after, limit },
      queryKey,
    ),
    queryFn: () => OrganizationService.listOrgs({ after, limit }) as TData,
    ...options,
  });

// generated with @7nohe/openapi-react-query-codegen@1.6.0

import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
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
  AuthRequest,
  BlockUpdate,
  Body_export_agent,
  Body_import_agent,
  Body_upload_file_to_folder,
  Body_upload_file_to_source,
  CancelAgentRunRequest,
  CodeInput,
  CreateAgentRequest,
  CreateArchivalMemory,
  CreateBatch,
  CreateBlock,
  DuplicateFileHandling,
  GenerateToolInput,
  GroupCreate,
  GroupUpdate,
  IdentityCreate,
  IdentityProperty,
  IdentityType,
  IdentityUpdate,
  IdentityUpsert,
  InternalTemplateAgentCreate,
  InternalTemplateBlockCreate,
  InternalTemplateGroupCreate,
  LettaAsyncRequest,
  LettaRequest,
  LettaStreamingRequest,
  LocalSandboxConfig,
  MCPToolExecuteRequest,
  ManagerType,
  MessageSearchRequest,
  ModifyFeedbackRequest,
  OrganizationCreate,
  OrganizationUpdate,
  ProviderCategory,
  ProviderCheck,
  ProviderCreate,
  ProviderType,
  ProviderUpdate,
  RetrieveStreamRequest,
  SSEServerConfig,
  SandboxConfigCreate,
  SandboxConfigUpdate,
  SandboxEnvironmentVariableCreate,
  SandboxEnvironmentVariableUpdate,
  SandboxType,
  SourceCreate,
  SourceUpdate,
  StdioServerConfig,
  StreamableHTTPServerConfig,
  ToolCreate,
  ToolRunFromSource,
  ToolUpdate,
  UpdateAgent,
  UpdateAssistantMessage,
  UpdateReasoningMessage,
  UpdateSSEMCPServer,
  UpdateStdioMCPServer,
  UpdateStreamableHTTPMCPServer,
  UpdateSystemMessage,
  UpdateUserMessage,
  UserCreate,
  UserUpdate,
} from '../requests/types.gen';
import * as Common from './common';
/**
 * Retrieve Tool
 * Get a tool by ID
 * @param data The data for the request.
 * @param data.toolId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceRetrieveTool = <
  TData = Common.ToolsServiceRetrieveToolDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    toolId,
    userAgent,
    userId,
    xProjectId,
  }: {
    toolId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceRetrieveToolKeyFn(
      { toolId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.retrieveTool({
        toolId,
        userAgent,
        userId,
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
 * @returns number Successful Response
 * @throws ApiError
 */
export const useToolsServiceCountTools = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceListTools = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns AppModel Successful Response
 * @throws ApiError
 */
export const useToolsServiceListComposioApps = <
  TData = Common.ToolsServiceListComposioAppsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioAppsKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listComposioApps({ userAgent, userId, xProjectId }) as TData,
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
 * @returns ActionModel Successful Response
 * @throws ApiError
 */
export const useToolsServiceListComposioActionsByApp = <
  TData = Common.ToolsServiceListComposioActionsByAppDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    composioAppName,
    userAgent,
    userId,
    xProjectId,
  }: {
    composioAppName: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioActionsByAppKeyFn(
      { composioAppName, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listComposioActionsByApp({
        composioAppName,
        userAgent,
        userId,
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
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceListMcpServers = <
  TData = Common.ToolsServiceListMcpServersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListMcpServersKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listMcpServers({ userAgent, userId, xProjectId }) as TData,
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
 * @returns MCPTool Successful Response
 * @throws ApiError
 */
export const useToolsServiceListMcpToolsByServer = <
  TData = Common.ToolsServiceListMcpToolsByServerDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    mcpServerName,
    userAgent,
    userId,
    xProjectId,
  }: {
    mcpServerName: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListMcpToolsByServerKeyFn(
      { mcpServerName, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listMcpToolsByServer({
        mcpServerName,
        userAgent,
        userId,
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
export const useToolsServiceMcpOauthCallback = <
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
  useQuery<TData, TError>({
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
 * @returns number Successful Response
 * @throws ApiError
 */
export const useSourcesServiceCountSources = <
  TData = Common.SourcesServiceCountSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceCountSourcesKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.countSources({ userAgent, userId, xProjectId }) as TData,
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
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceRetrieveSource = <
  TData = Common.SourcesServiceRetrieveSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    sourceId,
    userAgent,
    userId,
    xProjectId,
  }: {
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceRetrieveSourceKeyFn(
      { sourceId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.retrieveSource({
        sourceId,
        userAgent,
        userId,
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
 * @returns string Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetSourceIdByName = <
  TData = Common.SourcesServiceGetSourceIdByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    sourceName,
    userAgent,
    userId,
    xProjectId,
  }: {
    sourceName: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn(
      { sourceName, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getSourceIdByName({
        sourceName,
        userAgent,
        userId,
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
 * @returns OrganizationSourcesStats Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetSourcesMetadata = <
  TData = Common.SourcesServiceGetSourcesMetadataDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    includeDetailedPerSourceMetadata,
    userAgent,
    userId,
    xProjectId,
  }: {
    includeDetailedPerSourceMetadata?: boolean;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourcesMetadataKeyFn(
      { includeDetailedPerSourceMetadata, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getSourcesMetadata({
        includeDetailedPerSourceMetadata,
        userAgent,
        userId,
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
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceListSources = <
  TData = Common.SourcesServiceListSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listSources({ userAgent, userId, xProjectId }) as TData,
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
 * @returns string Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetAgentsForSource = <
  TData = Common.SourcesServiceGetAgentsForSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    sourceId,
    userAgent,
    userId,
    xProjectId,
  }: {
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetAgentsForSourceKeyFn(
      { sourceId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getAgentsForSource({
        sourceId,
        userAgent,
        userId,
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
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useSourcesServiceListSourcePassages = <
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
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn(
      { after, before, limit, sourceId, userAgent, userId, xProjectId },
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
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useSourcesServiceListSourceFiles = <
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
    xProjectId,
  }: {
    after?: string;
    checkStatusUpdates?: boolean;
    includeContent?: boolean;
    limit?: number;
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourceFilesKeyFn(
      {
        after,
        checkStatusUpdates,
        includeContent,
        limit,
        sourceId,
        userAgent,
        userId,
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
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetFileMetadata = <
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
    xProjectId,
  }: {
    fileId: string;
    includeContent?: boolean;
    sourceId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetFileMetadataKeyFn(
      { fileId, includeContent, sourceId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getFileMetadata({
        fileId,
        includeContent,
        sourceId,
        userAgent,
        userId,
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
 * @returns number Successful Response
 * @throws ApiError
 */
export const useFoldersServiceCountFolders = <
  TData = Common.FoldersServiceCountFoldersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceCountFoldersKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      FoldersService.countFolders({ userAgent, userId, xProjectId }) as TData,
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
 * @returns Folder Successful Response
 * @throws ApiError
 */
export const useFoldersServiceRetrieveFolder = <
  TData = Common.FoldersServiceRetrieveFolderDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    folderId,
    userAgent,
    userId,
    xProjectId,
  }: {
    folderId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceRetrieveFolderKeyFn(
      { folderId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      FoldersService.retrieveFolder({
        folderId,
        userAgent,
        userId,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * @deprecated
 * Get Folder By Name
 * **Deprecated**: Please use the list endpoint `/GET v1/folders?name=` instead.
 *
 *
 * Get a folder by name.
 * @param data The data for the request.
 * @param data.folderName
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns string Successful Response
 * @throws ApiError
 */
export const useFoldersServiceGetFolderByName = <
  TData = Common.FoldersServiceGetFolderByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    folderName,
    userAgent,
    userId,
    xProjectId,
  }: {
    folderName: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceGetFolderByNameKeyFn(
      { folderName, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      FoldersService.getFolderByName({
        folderName,
        userAgent,
        userId,
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
 * @returns OrganizationSourcesStats Successful Response
 * @throws ApiError
 */
export const useFoldersServiceRetrieveMetadata = <
  TData = Common.FoldersServiceRetrieveMetadataDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    includeDetailedPerSourceMetadata,
    userAgent,
    userId,
    xProjectId,
  }: {
    includeDetailedPerSourceMetadata?: boolean;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseFoldersServiceRetrieveMetadataKeyFn(
      { includeDetailedPerSourceMetadata, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      FoldersService.retrieveMetadata({
        includeDetailedPerSourceMetadata,
        userAgent,
        userId,
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
 * @returns Folder Successful Response
 * @throws ApiError
 */
export const useFoldersServiceListFolders = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns string Successful Response
 * @throws ApiError
 */
export const useFoldersServiceListAgentsForFolder = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useFoldersServiceListFolderPassages = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useFoldersServiceListFolderFiles = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgents = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns number Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCountAgents = <
  TData = Common.AgentsServiceCountAgentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceCountAgentsKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.countAgents({ userAgent, userId, xProjectId }) as TData,
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
 * @param data.requestBody
 * @returns string Successful Response
 * @throws ApiError
 */
export const useAgentsServiceExportAgent = <
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
    xProjectId,
  }: {
    agentId: string;
    maxSteps?: number;
    requestBody?: Body_export_agent;
    useLegacyFormat?: boolean;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceExportAgentKeyFn(
      {
        agentId,
        maxSteps,
        requestBody,
        useLegacyFormat,
        userAgent,
        userId,
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
 * @returns ContextWindowOverview Successful Response
 * @throws ApiError
 */
export const useAgentsServiceRetrieveAgentContextWindow = <
  TData = Common.AgentsServiceRetrieveAgentContextWindowDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentContextWindowKeyFn(
      { agentId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgentContextWindow({
        agentId,
        userAgent,
        userId,
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
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceRetrieveAgent = <
  TData = Common.AgentsServiceRetrieveAgentDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    includeRelationships,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    includeRelationships?: string[];
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentKeyFn(
      { agentId, includeRelationships, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgent({
        agentId,
        includeRelationships,
        userAgent,
        userId,
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
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentTools = <
  TData = Common.AgentsServiceListAgentToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentToolsKeyFn(
      { agentId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentTools({
        agentId,
        userAgent,
        userId,
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
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentSources = <
  TData = Common.AgentsServiceListAgentSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentSourcesKeyFn(
      { agentId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentSources({
        agentId,
        userAgent,
        userId,
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
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentFolders = <
  TData = Common.AgentsServiceListAgentFoldersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentFoldersKeyFn(
      { agentId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentFolders({
        agentId,
        userAgent,
        userId,
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
 * @returns PaginatedAgentFiles Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentFiles = <
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
    xProjectId,
  }: {
    agentId: string;
    cursor?: string;
    isOpen?: boolean;
    limit?: number;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentFilesKeyFn(
      { agentId, cursor, isOpen, limit, userAgent, userId, xProjectId },
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
 * @returns Memory Successful Response
 * @throws ApiError
 */
export const useAgentsServiceRetrieveAgentMemory = <
  TData = Common.AgentsServiceRetrieveAgentMemoryDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentMemoryKeyFn(
      { agentId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgentMemory({
        agentId,
        userAgent,
        userId,
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
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useAgentsServiceRetrieveCoreMemoryBlock = <
  TData = Common.AgentsServiceRetrieveCoreMemoryBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    blockLabel,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    blockLabel: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveCoreMemoryBlockKeyFn(
      { agentId, blockLabel, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveCoreMemoryBlock({
        agentId,
        blockLabel,
        userAgent,
        userId,
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
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListCoreMemoryBlocks = <
  TData = Common.AgentsServiceListCoreMemoryBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListCoreMemoryBlocksKeyFn(
      { agentId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listCoreMemoryBlocks({
        agentId,
        userAgent,
        userId,
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
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListPassages = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns ArchivalMemorySearchResponse Successful Response
 * @throws ApiError
 */
export const useAgentsServiceSearchArchivalMemory = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns LettaMessageUnion Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListMessages = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentGroups = <
  TData = Common.AgentsServiceListAgentGroupsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    managerType,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentId: string;
    managerType?: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentGroupsKeyFn(
      { agentId, managerType, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentGroups({
        agentId,
        managerType,
        userAgent,
        userId,
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
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useGroupsServiceListGroups = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns number Successful Response
 * @throws ApiError
 */
export const useGroupsServiceCountGroups = <
  TData = Common.GroupsServiceCountGroupsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceCountGroupsKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      GroupsService.countGroups({ userAgent, userId, xProjectId }) as TData,
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
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useGroupsServiceRetrieveGroup = <
  TData = Common.GroupsServiceRetrieveGroupDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    groupId,
    userAgent,
    userId,
    xProjectId,
  }: {
    groupId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceRetrieveGroupKeyFn(
      { groupId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      GroupsService.retrieveGroup({
        groupId,
        userAgent,
        userId,
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
 * @returns LettaMessageUnion Successful Response
 * @throws ApiError
 */
export const useGroupsServiceListGroupMessages = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns Identity Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceListIdentities = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns number Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceCountIdentities = <
  TData = Common.IdentitiesServiceCountIdentitiesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceCountIdentitiesKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      IdentitiesService.countIdentities({
        userAgent,
        userId,
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
 * @returns Identity Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceRetrieveIdentity = <
  TData = Common.IdentitiesServiceRetrieveIdentityDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    identityId,
    userAgent,
    userId,
    xProjectId,
  }: {
    identityId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceRetrieveIdentityKeyFn(
      { identityId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      IdentitiesService.retrieveIdentity({
        identityId,
        userAgent,
        userId,
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
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceListAgentsForIdentity = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceListBlocksForIdentity = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns ListDeploymentEntitiesResponse Successful Response
 * @throws ApiError
 */
export const useInternalTemplatesServiceListDeploymentEntities = <
  TData = Common.InternalTemplatesServiceListDeploymentEntitiesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    deploymentId,
    entityTypes,
    userAgent,
    userId,
    xProjectId,
  }: {
    deploymentId: string;
    entityTypes?: string[];
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseInternalTemplatesServiceListDeploymentEntitiesKeyFn(
      { deploymentId, entityTypes, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      InternalTemplatesService.listDeploymentEntities({
        deploymentId,
        entityTypes,
        userAgent,
        userId,
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
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const useModelsServiceListModels = <
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
    xProjectId,
  }: {
    providerCategory?: ProviderCategory[];
    providerName?: string;
    providerType?: ProviderType;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListModelsKeyFn(
      {
        providerCategory,
        providerName,
        providerType,
        userAgent,
        userId,
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
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const useModelsServiceListEmbeddingModels = <
  TData = Common.ModelsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      ModelsService.listEmbeddingModels({
        userAgent,
        userId,
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
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const useLlmsServiceListModels = <
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
    xProjectId,
  }: {
    providerCategory?: ProviderCategory[];
    providerName?: string;
    providerType?: ProviderType;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListModelsKeyFn(
      {
        providerCategory,
        providerName,
        providerType,
        userAgent,
        userId,
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
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const useLlmsServiceListEmbeddingModels = <
  TData = Common.LlmsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      LlmsService.listEmbeddingModels({
        userAgent,
        userId,
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
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceListBlocks = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns number Successful Response
 * @throws ApiError
 */
export const useBlocksServiceCountBlocks = <
  TData = Common.BlocksServiceCountBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userAgent,
    userId,
    xProjectId,
  }: {
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceCountBlocksKeyFn(
      { userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      BlocksService.countBlocks({ userAgent, userId, xProjectId }) as TData,
    ...options,
  });
/**
 * Retrieve Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceRetrieveBlock = <
  TData = Common.BlocksServiceRetrieveBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    blockId,
    userAgent,
    userId,
    xProjectId,
  }: {
    blockId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceRetrieveBlockKeyFn(
      { blockId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      BlocksService.retrieveBlock({
        blockId,
        userAgent,
        userId,
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
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useBlocksServiceListAgentsForBlock = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Jobs
 * List all jobs.
 * TODO (cliandy): implementation for pagination
 * @param data The data for the request.
 * @param data.sourceId Only list jobs associated with the source.
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Limit for pagination
 * @param data.ascending Whether to sort jobs oldest to newest (True, default) or newest to oldest (False)
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceListJobs = <
  TData = Common.JobsServiceListJobsDefaultResponse,
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
    xProjectId,
  }: {
    after?: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    sourceId?: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsKeyFn(
      {
        after,
        ascending,
        before,
        limit,
        sourceId,
        userAgent,
        userId,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      JobsService.listJobs({
        after,
        ascending,
        before,
        limit,
        sourceId,
        userAgent,
        userId,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
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
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceListActiveJobs = <
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
    xProjectId,
  }: {
    after?: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    sourceId?: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn(
      {
        after,
        ascending,
        before,
        limit,
        sourceId,
        userAgent,
        userId,
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
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceRetrieveJob = <
  TData = Common.JobsServiceRetrieveJobDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    jobId,
    userAgent,
    userId,
    xProjectId,
  }: {
    jobId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceRetrieveJobKeyFn(
      { jobId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      JobsService.retrieveJob({
        jobId,
        userAgent,
        userId,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * Check Health
 * @returns Health Successful Response
 * @throws ApiError
 */
export const useHealthServiceCheckHealth = <
  TData = Common.HealthServiceCheckHealthDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns SandboxConfig Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceListSandboxConfigsV1SandboxConfigGet = <
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
    xProjectId,
  }: {
    after?: string;
    limit?: number;
    sandboxType?: SandboxType;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey:
      Common.UseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKeyFn(
        { after, limit, sandboxType, userAgent, userId, xProjectId },
        queryKey,
      ),
    queryFn: () =>
      SandboxConfigService.listSandboxConfigsV1SandboxConfigGet({
        after,
        limit,
        sandboxType,
        userAgent,
        userId,
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
 * @returns SandboxEnvironmentVariable Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet =
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
      xProjectId,
    }: {
      after?: string;
      limit?: number;
      sandboxConfigId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    queryKey?: TQueryKey,
    options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
  ) =>
    useQuery<TData, TError>({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKeyFn(
          { after, limit, sandboxConfigId, userAgent, userId, xProjectId },
          queryKey,
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
          { after, limit, sandboxConfigId, userAgent, userId, xProjectId },
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
 * @returns Provider Successful Response
 * @throws ApiError
 */
export const useProvidersServiceListProviders = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns Provider Successful Response
 * @throws ApiError
 */
export const useProvidersServiceRetrieveProvider = <
  TData = Common.ProvidersServiceRetrieveProviderDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    providerId,
    userAgent,
    userId,
    xProjectId,
  }: {
    providerId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseProvidersServiceRetrieveProviderKeyFn(
      { providerId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      ProvidersService.retrieveProvider({
        providerId,
        userAgent,
        userId,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Runs
 * List all runs.
 * @param data The data for the request.
 * @param data.agentIds The unique identifier of the agent associated with the run.
 * @param data.background If True, filters for runs that were created in background mode.
 * @param data.after Cursor for pagination
 * @param data.before Cursor for pagination
 * @param data.limit Maximum number of runs to return
 * @param data.ascending Whether to sort agents oldest to newest (True) or newest to oldest (False, default)
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceListRuns = <
  TData = Common.RunsServiceListRunsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    after,
    agentIds,
    ascending,
    background,
    before,
    limit,
    userAgent,
    userId,
    xProjectId,
  }: {
    after?: string;
    agentIds?: string[];
    ascending?: boolean;
    background?: boolean;
    before?: string;
    limit?: number;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunsKeyFn(
      {
        after,
        agentIds,
        ascending,
        background,
        before,
        limit,
        userAgent,
        userId,
        xProjectId,
      },
      queryKey,
    ),
    queryFn: () =>
      RunsService.listRuns({
        after,
        agentIds,
        ascending,
        background,
        before,
        limit,
        userAgent,
        userId,
        xProjectId,
      }) as TData,
    ...options,
  });
/**
 * List Active Runs
 * List all active runs.
 * @param data The data for the request.
 * @param data.agentIds The unique identifier of the agent associated with the run.
 * @param data.background If True, filters for runs that were created in background mode.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceListActiveRuns = <
  TData = Common.RunsServiceListActiveRunsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentIds,
    background,
    userAgent,
    userId,
    xProjectId,
  }: {
    agentIds?: string[];
    background?: boolean;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListActiveRunsKeyFn(
      { agentIds, background, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      RunsService.listActiveRuns({
        agentIds,
        background,
        userAgent,
        userId,
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
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceRetrieveRun = <
  TData = Common.RunsServiceRetrieveRunDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    runId,
    userAgent,
    userId,
    xProjectId,
  }: {
    runId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceRetrieveRunKeyFn(
      { runId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      RunsService.retrieveRun({
        runId,
        userAgent,
        userId,
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
 * @returns LettaMessageUnion Successful Response
 * @throws ApiError
 */
export const useRunsServiceListRunMessages = <
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
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    runId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunMessagesKeyFn(
      { after, before, limit, order, runId, userAgent, userId, xProjectId },
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
 * @returns UsageStatistics Successful Response
 * @throws ApiError
 */
export const useRunsServiceRetrieveRunUsage = <
  TData = Common.RunsServiceRetrieveRunUsageDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    runId,
    userAgent,
    userId,
    xProjectId,
  }: {
    runId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceRetrieveRunUsageKeyFn(
      { runId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      RunsService.retrieveRunUsage({
        runId,
        userAgent,
        userId,
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
 * @returns Step Successful Response
 * @throws ApiError
 */
export const useRunsServiceListRunSteps = <
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
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: string;
    runId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunStepsKeyFn(
      { after, before, limit, order, runId, userAgent, userId, xProjectId },
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
 * @returns Step Successful Response
 * @throws ApiError
 */
export const useStepsServiceListSteps = <
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
    xProject?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns Step Successful Response
 * @throws ApiError
 */
export const useStepsServiceRetrieveStep = <
  TData = Common.StepsServiceRetrieveStepDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    stepId,
    userAgent,
    userId,
    xProjectId,
  }: {
    stepId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseStepsServiceRetrieveStepKeyFn(
      { stepId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      StepsService.retrieveStep({
        stepId,
        userAgent,
        userId,
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
 * @returns StepMetrics Successful Response
 * @throws ApiError
 */
export const useStepsServiceRetrieveMetricsForStep = <
  TData = Common.StepsServiceRetrieveMetricsForStepDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    stepId,
    userAgent,
    userId,
    xProjectId,
  }: {
    stepId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseStepsServiceRetrieveMetricsForStepKeyFn(
      { stepId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      StepsService.retrieveMetricsForStep({
        stepId,
        userAgent,
        userId,
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
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useStepsServiceRetrieveTraceForStep = <
  TData = Common.StepsServiceRetrieveTraceForStepDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    stepId,
    userAgent,
    userId,
    xProjectId,
  }: {
    stepId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseStepsServiceRetrieveTraceForStepKeyFn(
      { stepId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      StepsService.retrieveTraceForStep({
        stepId,
        userAgent,
        userId,
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
 * @returns string Successful Response
 * @throws ApiError
 */
export const useTagServiceListTags = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns string Successful Response
 * @throws ApiError
 */
export const useAdminServiceListTags = <
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
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
export const useAdminServiceListUsers = <
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
  useQuery<TData, TError>({
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
export const useAdminServiceListOrgs = <
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
  useQuery<TData, TError>({
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
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useTelemetryServiceRetrieveProviderTrace = <
  TData = Common.TelemetryServiceRetrieveProviderTraceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    stepId,
    userAgent,
    userId,
    xProjectId,
  }: {
    stepId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseTelemetryServiceRetrieveProviderTraceKeyFn(
      { stepId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      TelemetryService.retrieveProviderTrace({
        stepId,
        userAgent,
        userId,
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
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const useMessagesServiceListBatches = <
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
    xProjectId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseMessagesServiceListBatchesKeyFn(
      { after, before, limit, order, orderBy, userAgent, userId, xProjectId },
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
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const useMessagesServiceRetrieveBatch = <
  TData = Common.MessagesServiceRetrieveBatchDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    batchId,
    userAgent,
    userId,
    xProjectId,
  }: {
    batchId: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseMessagesServiceRetrieveBatchKeyFn(
      { batchId, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      MessagesService.retrieveBatch({
        batchId,
        userAgent,
        userId,
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
 * @returns LettaBatchMessages Successful Response
 * @throws ApiError
 */
export const useMessagesServiceListMessagesForBatch = <
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
    xProjectId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
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
 * @returns number Successful Response
 * @throws ApiError
 */
export const useEmbeddingsServiceGetTotalStorageSize = <
  TData = Common.EmbeddingsServiceGetTotalStorageSizeDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    storageUnit,
    userAgent,
    userId,
    xProjectId,
  }: {
    storageUnit?: string;
    userAgent?: string;
    userId?: string;
    xProjectId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseEmbeddingsServiceGetTotalStorageSizeKeyFn(
      { storageUnit, userAgent, userId, xProjectId },
      queryKey,
    ),
    queryFn: () =>
      EmbeddingsService.getTotalStorageSize({
        storageUnit,
        userAgent,
        userId,
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
export const useUsersServiceListUsers = <
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
  useQuery<TData, TError>({
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
export const useOrganizationServiceListOrgs = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseOrganizationServiceListOrgsKeyFn(
      { after, limit },
      queryKey,
    ),
    queryFn: () => OrganizationService.listOrgs({ after, limit }) as TData,
    ...options,
  });
/**
 * Create Tool
 * Create a new tool
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceCreateTool = <
  TData = Common.ToolsServiceCreateToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ToolCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: ToolCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ToolsService.createTool({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upsert Base Tools
 * Upsert base tools
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceAddBaseTools = <
  TData = Common.ToolsServiceAddBaseToolsMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ userAgent, userId, xProjectId }) =>
      ToolsService.addBaseTools({
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Run Tool From Source
 * Attempt to build a tool from source, then run it on the provided arguments
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns ToolReturnMessage Successful Response
 * @throws ApiError
 */
export const useToolsServiceRunToolFromSource = <
  TData = Common.ToolsServiceRunToolFromSourceMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ToolRunFromSource;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: ToolRunFromSource;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ToolsService.runToolFromSource({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Add Composio Tool
 * Add a new Composio tool by action name (Composio refers to each tool as an `Action`)
 * @param data The data for the request.
 * @param data.composioActionName
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceAddComposioTool = <
  TData = Common.ToolsServiceAddComposioToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        composioActionName: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      composioActionName: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ composioActionName, userAgent, userId, xProjectId }) =>
      ToolsService.addComposioTool({
        composioActionName,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Resync Mcp Server Tools
 * Resync tools for an MCP server by:
 * 1. Fetching current tools from the MCP server
 * 2. Deleting tools that no longer exist on the server
 * 3. Updating schemas for existing tools
 * 4. Adding new tools from the server
 *
 * Returns a summary of changes made.
 * @param data The data for the request.
 * @param data.mcpServerName
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceResyncMcpServerTools = <
  TData = Common.ToolsServiceResyncMcpServerToolsMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId?: string;
        mcpServerName: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId?: string;
      mcpServerName: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, mcpServerName, userAgent, userId, xProjectId }) =>
      ToolsService.resyncMcpServerTools({
        agentId,
        mcpServerName,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Add Mcp Tool
 * Register a new MCP tool as a Letta server by MCP server + tool name
 * @param data The data for the request.
 * @param data.mcpServerName
 * @param data.mcpToolName
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceAddMcpTool = <
  TData = Common.ToolsServiceAddMcpToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        mcpServerName: string;
        mcpToolName: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      mcpServerName: string;
      mcpToolName: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      mcpServerName,
      mcpToolName,
      userAgent,
      userId,
      xProjectId,
    }) =>
      ToolsService.addMcpTool({
        mcpServerName,
        mcpToolName,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Test Mcp Server
 * Test connection to an MCP server without adding it.
 * Returns the list of available tools if successful.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceTestMcpServer = <
  TData = Common.ToolsServiceTestMcpServerMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody:
          | StdioServerConfig
          | SSEServerConfig
          | StreamableHTTPServerConfig;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody:
        | StdioServerConfig
        | SSEServerConfig
        | StreamableHTTPServerConfig;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ToolsService.testMcpServer({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Connect Mcp Server
 * Connect to an MCP server with support for OAuth via SSE.
 * Returns a stream of events handling authorization state and exchange if OAuth is required.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful response
 * @throws ApiError
 */
export const useToolsServiceConnectMcpServer = <
  TData = Common.ToolsServiceConnectMcpServerMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody:
          | StdioServerConfig
          | SSEServerConfig
          | StreamableHTTPServerConfig;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody:
        | StdioServerConfig
        | SSEServerConfig
        | StreamableHTTPServerConfig;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ToolsService.connectMcpServer({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Generate Json Schema
 * Generate a JSON schema from the given source code defining a function or class.
 * Supports both Python and TypeScript source code.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceGenerateJsonSchema = <
  TData = Common.ToolsServiceGenerateJsonSchemaMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CodeInput;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: CodeInput;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ToolsService.generateJsonSchema({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Execute Mcp Tool
 * Execute a specific MCP tool from a configured server.
 * Returns the tool execution result.
 * @param data The data for the request.
 * @param data.mcpServerName
 * @param data.toolName
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceExecuteMcpTool = <
  TData = Common.ToolsServiceExecuteMcpToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        mcpServerName: string;
        requestBody: MCPToolExecuteRequest;
        toolName: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      mcpServerName: string;
      requestBody: MCPToolExecuteRequest;
      toolName: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      mcpServerName,
      requestBody,
      toolName,
      userAgent,
      userId,
      xProjectId,
    }) =>
      ToolsService.executeMcpTool({
        mcpServerName,
        requestBody,
        toolName,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Generate Tool From Prompt
 * Generate a tool from the given user prompt.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns GenerateToolOutput Successful Response
 * @throws ApiError
 */
export const useToolsServiceGenerateTool = <
  TData = Common.ToolsServiceGenerateToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: GenerateToolInput;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: GenerateToolInput;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ToolsService.generateTool({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * @deprecated
 * Create Source
 * Create a new data source.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceCreateSource = <
  TData = Common.SourcesServiceCreateSourceMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: SourceCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: SourceCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      SourcesService.createSource({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * @deprecated
 * Upload File To Source
 * Upload a file to a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.formData
 * @param data.duplicateHandling How to handle duplicate filenames
 * @param data.name Optional custom name to override the uploaded file's name
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useSourcesServiceUploadFileToSource = <
  TData = Common.SourcesServiceUploadFileToSourceMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        duplicateHandling?: DuplicateFileHandling;
        formData: Body_upload_file_to_source;
        name?: string;
        sourceId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      duplicateHandling?: DuplicateFileHandling;
      formData: Body_upload_file_to_source;
      name?: string;
      sourceId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      duplicateHandling,
      formData,
      name,
      sourceId,
      userAgent,
      userId,
      xProjectId,
    }) =>
      SourcesService.uploadFileToSource({
        duplicateHandling,
        formData,
        name,
        sourceId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Folder
 * Create a new data folder.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Folder Successful Response
 * @throws ApiError
 */
export const useFoldersServiceCreateFolder = <
  TData = Common.FoldersServiceCreateFolderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: SourceCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: SourceCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      FoldersService.createFolder({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upload File To Folder
 * Upload a file to a data folder.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.formData
 * @param data.duplicateHandling How to handle duplicate filenames
 * @param data.name Optional custom name to override the uploaded file's name
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useFoldersServiceUploadFileToFolder = <
  TData = Common.FoldersServiceUploadFileToFolderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        duplicateHandling?: DuplicateFileHandling;
        folderId: string;
        formData: Body_upload_file_to_folder;
        name?: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      duplicateHandling?: DuplicateFileHandling;
      folderId: string;
      formData: Body_upload_file_to_folder;
      name?: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      duplicateHandling,
      folderId,
      formData,
      name,
      userAgent,
      userId,
      xProjectId,
    }) =>
      FoldersService.uploadFileToFolder({
        duplicateHandling,
        folderId,
        formData,
        name,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Agent
 * Create an agent.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.xProject The project slug to associate with the agent (cloud only).
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCreateAgent = <
  TData = Common.AgentsServiceCreateAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CreateAgentRequest;
        userAgent?: string;
        userId?: string;
        xProject?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: CreateAgentRequest;
      userAgent?: string;
      userId?: string;
      xProject?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProject, xProjectId }) =>
      AgentsService.createAgent({
        requestBody,
        userAgent,
        userId,
        xProject,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Import Agent
 * Import a serialized agent file and recreate the agent(s) in the system.
 * Returns the IDs of all imported agents.
 * @param data The data for the request.
 * @param data.formData
 * @param data.xOverrideEmbeddingModel
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns ImportedAgentsResponse Successful Response
 * @throws ApiError
 */
export const useAgentsServiceImportAgent = <
  TData = Common.AgentsServiceImportAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        formData: Body_import_agent;
        userAgent?: string;
        userId?: string;
        xOverrideEmbeddingModel?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      formData: Body_import_agent;
      userAgent?: string;
      userId?: string;
      xOverrideEmbeddingModel?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      formData,
      userAgent,
      userId,
      xOverrideEmbeddingModel,
      xProjectId,
    }) =>
      AgentsService.importAgent({
        formData,
        userAgent,
        userId,
        xOverrideEmbeddingModel,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Passage
 * Insert a memory into an agent's archival memory store.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCreatePassage = <
  TData = Common.AgentsServiceCreatePassageMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: CreateArchivalMemory;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: CreateArchivalMemory;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userAgent, userId, xProjectId }) =>
      AgentsService.createPassage({
        agentId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Send Message
 * Process a user message and return the agent's response.
 * This endpoint accepts a message from a user and processes it through the agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns LettaResponse Successful Response
 * @throws ApiError
 */
export const useAgentsServiceSendMessage = <
  TData = Common.AgentsServiceSendMessageMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: LettaRequest;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: LettaRequest;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userAgent, userId, xProjectId }) =>
      AgentsService.sendMessage({
        agentId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Send Message Streaming
 * Process a user message and return the agent's response.
 * This endpoint accepts a message from a user and processes it through the agent.
 * It will stream the steps of the response always, and stream the tokens if 'stream_tokens' is set to True.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful response
 * @throws ApiError
 */
export const useAgentsServiceCreateAgentMessageStream = <
  TData = Common.AgentsServiceCreateAgentMessageStreamMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: LettaStreamingRequest;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: LettaStreamingRequest;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userAgent, userId, xProjectId }) =>
      AgentsService.createAgentMessageStream({
        agentId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Cancel Agent Run
 * Cancel runs associated with an agent. If run_ids are passed in, cancel those in particular.
 *
 * Note to cancel active runs associated with an agent, redis is required.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.requestBody
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCancelAgentRun = <
  TData = Common.AgentsServiceCancelAgentRunMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody?: CancelAgentRunRequest;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody?: CancelAgentRunRequest;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userAgent, userId, xProjectId }) =>
      AgentsService.cancelAgentRun({
        agentId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Search Messages
 * Search messages across the entire organization with optional project and template filtering. Returns messages with FTS/vector ranks and total RRF score.
 *
 * This is a cloud-only feature.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns MessageSearchResult Successful Response
 * @throws ApiError
 */
export const useAgentsServiceSearchMessages = <
  TData = Common.AgentsServiceSearchMessagesMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: MessageSearchRequest;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: MessageSearchRequest;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      AgentsService.searchMessages({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Send Message Async
 * Asynchronously process a user message and return a run object.
 * The actual processing happens in the background, and the status can be checked using the run ID.
 *
 * This is "asynchronous" in the sense that it's a background job and explicitly must be fetched by the run ID.
 * This is more like `send_message_job`
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCreateAgentMessageAsync = <
  TData = Common.AgentsServiceCreateAgentMessageAsyncMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: LettaAsyncRequest;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: LettaAsyncRequest;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userAgent, userId, xProjectId }) =>
      AgentsService.createAgentMessageAsync({
        agentId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Preview Raw Payload
 * Inspect the raw LLM request payload without sending it.
 *
 * This endpoint processes the message through the agent loop up until
 * the LLM request, then returns the raw request payload that would
 * be sent to the LLM provider. Useful for debugging and inspection.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServicePreviewRawPayload = <
  TData = Common.AgentsServicePreviewRawPayloadMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: LettaRequest | LettaStreamingRequest;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: LettaRequest | LettaStreamingRequest;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userAgent, userId, xProjectId }) =>
      AgentsService.previewRawPayload({
        agentId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Summarize Agent Conversation
 * Summarize an agent's conversation history to a target message length.
 *
 * This endpoint summarizes the current message history for a given agent,
 * truncating and compressing it down to the specified `max_message_length`.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.maxMessageLength Maximum number of messages to retain after summarization.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns void Successful Response
 * @throws ApiError
 */
export const useAgentsServiceSummarizeAgentConversation = <
  TData = Common.AgentsServiceSummarizeAgentConversationMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        maxMessageLength: number;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      maxMessageLength: number;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      agentId,
      maxMessageLength,
      userAgent,
      userId,
      xProjectId,
    }) =>
      AgentsService.summarizeAgentConversation({
        agentId,
        maxMessageLength,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Group
 * Create a new multi-agent group with the specified configuration.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.xProject The project slug to associate with the group (cloud only).
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useGroupsServiceCreateGroup = <
  TData = Common.GroupsServiceCreateGroupMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: GroupCreate;
        userAgent?: string;
        userId?: string;
        xProject?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: GroupCreate;
      userAgent?: string;
      userId?: string;
      xProject?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProject, xProjectId }) =>
      GroupsService.createGroup({
        requestBody,
        userAgent,
        userId,
        xProject,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Send Group Message
 * Process a user message and return the group's response.
 * This endpoint accepts a message from a user and processes it through through agents in the group based on the specified pattern
 * @param data The data for the request.
 * @param data.groupId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns LettaResponse Successful Response
 * @throws ApiError
 */
export const useGroupsServiceSendGroupMessage = <
  TData = Common.GroupsServiceSendGroupMessageMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        groupId: string;
        requestBody: LettaRequest;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      groupId: string;
      requestBody: LettaRequest;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, requestBody, userAgent, userId, xProjectId }) =>
      GroupsService.sendGroupMessage({
        groupId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Send Group Message Streaming
 * Process a user message and return the group's responses.
 * This endpoint accepts a message from a user and processes it through agents in the group based on the specified pattern.
 * It will stream the steps of the response always, and stream the tokens if 'stream_tokens' is set to True.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful response
 * @throws ApiError
 */
export const useGroupsServiceSendGroupMessageStreaming = <
  TData = Common.GroupsServiceSendGroupMessageStreamingMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        groupId: string;
        requestBody: LettaStreamingRequest;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      groupId: string;
      requestBody: LettaStreamingRequest;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, requestBody, userAgent, userId, xProjectId }) =>
      GroupsService.sendGroupMessageStreaming({
        groupId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Identity
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.xProject The project slug to associate with the identity (cloud only).
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Identity Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceCreateIdentity = <
  TData = Common.IdentitiesServiceCreateIdentityMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: IdentityCreate;
        userAgent?: string;
        userId?: string;
        xProject?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: IdentityCreate;
      userAgent?: string;
      userId?: string;
      xProject?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProject, xProjectId }) =>
      IdentitiesService.createIdentity({
        requestBody,
        userAgent,
        userId,
        xProject,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Group
 * Create a new multi-agent group with the specified configuration.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useInternalTemplatesServiceCreateInternalTemplateGroup = <
  TData = Common.InternalTemplatesServiceCreateInternalTemplateGroupMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: InternalTemplateGroupCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: InternalTemplateGroupCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      InternalTemplatesService.createInternalTemplateGroup({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Agent
 * Create a new agent with template-related fields.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useInternalTemplatesServiceCreateInternalTemplateAgent = <
  TData = Common.InternalTemplatesServiceCreateInternalTemplateAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: InternalTemplateAgentCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: InternalTemplateAgentCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      InternalTemplatesService.createInternalTemplateAgent({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Block
 * Create a new block with template-related fields.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useInternalTemplatesServiceCreateInternalTemplateBlock = <
  TData = Common.InternalTemplatesServiceCreateInternalTemplateBlockMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: InternalTemplateBlockCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: InternalTemplateBlockCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      InternalTemplatesService.createInternalTemplateBlock({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Block
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceCreateBlock = <
  TData = Common.BlocksServiceCreateBlockMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CreateBlock;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: CreateBlock;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      BlocksService.createBlock({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Sandbox Config
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns SandboxConfig Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceCreateSandboxConfigV1SandboxConfigPost = <
  TData = Common.SandboxConfigServiceCreateSandboxConfigV1SandboxConfigPostMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: SandboxConfigCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: SandboxConfigCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      SandboxConfigService.createSandboxConfigV1SandboxConfigPost({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Default E2B Sandbox Config
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns SandboxConfig Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceCreateDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPost =
  <
    TData = Common.SandboxConfigServiceCreateDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPostMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({ userAgent, userId, xProjectId }) =>
        SandboxConfigService.createDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPost(
          { userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Create Default Local Sandbox Config
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns SandboxConfig Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceCreateDefaultLocalSandboxConfigV1SandboxConfigLocalDefaultPost =
  <
    TData = Common.SandboxConfigServiceCreateDefaultLocalSandboxConfigV1SandboxConfigLocalDefaultPostMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({ userAgent, userId, xProjectId }) =>
        SandboxConfigService.createDefaultLocalSandboxConfigV1SandboxConfigLocalDefaultPost(
          { userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Create Custom Local Sandbox Config
 * Create or update a custom LocalSandboxConfig, including pip_requirements.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns SandboxConfig Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceCreateCustomLocalSandboxConfigV1SandboxConfigLocalPost =
  <
    TData = Common.SandboxConfigServiceCreateCustomLocalSandboxConfigV1SandboxConfigLocalPostMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          requestBody: LocalSandboxConfig;
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        requestBody: LocalSandboxConfig;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
        SandboxConfigService.createCustomLocalSandboxConfigV1SandboxConfigLocalPost(
          { requestBody, userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Force Recreate Local Sandbox Venv
 * Forcefully recreate the virtual environment for the local sandbox.
 * Deletes and recreates the venv, then reinstalls required dependencies.
 * @param data The data for the request.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns SandboxConfig Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceForceRecreateLocalSandboxVenvV1SandboxConfigLocalRecreateVenvPost =
  <
    TData = Common.SandboxConfigServiceForceRecreateLocalSandboxVenvV1SandboxConfigLocalRecreateVenvPostMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({ userAgent, userId, xProjectId }) =>
        SandboxConfigService.forceRecreateLocalSandboxVenvV1SandboxConfigLocalRecreateVenvPost(
          { userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Create Sandbox Env Var
 * @param data The data for the request.
 * @param data.sandboxConfigId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns SandboxEnvironmentVariable Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceCreateSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePost =
  <
    TData = Common.SandboxConfigServiceCreateSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePostMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          requestBody: SandboxEnvironmentVariableCreate;
          sandboxConfigId: string;
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        requestBody: SandboxEnvironmentVariableCreate;
        sandboxConfigId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({
        requestBody,
        sandboxConfigId,
        userAgent,
        userId,
        xProjectId,
      }) =>
        SandboxConfigService.createSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePost(
          { requestBody, sandboxConfigId, userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Create Provider
 * Create a new custom provider.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Provider Successful Response
 * @throws ApiError
 */
export const useProvidersServiceCreateProvider = <
  TData = Common.ProvidersServiceCreateProviderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ProviderCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: ProviderCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ProvidersService.createProvider({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Check Provider
 * Verify the API key and additional parameters for a provider.
 * @param data The data for the request.
 * @param data.requestBody
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useProvidersServiceCheckProvider = <
  TData = Common.ProvidersServiceCheckProviderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ProviderCheck;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: ProviderCheck;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      ProvidersService.checkProvider({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Retrieve Stream
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.requestBody
 * @returns unknown Successful response
 * @throws ApiError
 */
export const useRunsServiceRetrieveStream = <
  TData = Common.RunsServiceRetrieveStreamMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody?: RetrieveStreamRequest;
        runId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody?: RetrieveStreamRequest;
      runId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, runId, userAgent, userId, xProjectId }) =>
      RunsService.retrieveStream({
        requestBody,
        runId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create User
 * Create a new user in the database
 * @param data The data for the request.
 * @param data.requestBody
 * @returns User Successful Response
 * @throws ApiError
 */
export const useAdminServiceCreateUser = <
  TData = Common.AdminServiceCreateUserMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: UserCreate;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: UserCreate;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      AdminService.createUser({ requestBody }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Org
 * Create a new org in the database
 * @param data The data for the request.
 * @param data.requestBody
 * @returns Organization Successful Response
 * @throws ApiError
 */
export const useAdminServiceCreateOrganization = <
  TData = Common.AdminServiceCreateOrganizationMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: OrganizationCreate;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: OrganizationCreate;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      AdminService.createOrganization({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Batch
 * Submit a batch of agent runs for asynchronous processing.
 *
 * Creates a job that will fan out messages to all listed agents and process them in parallel.
 * The request will be rejected if it exceeds 256MB.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const useMessagesServiceCreateBatch = <
  TData = Common.MessagesServiceCreateBatchMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CreateBatch;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: CreateBatch;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      MessagesService.createBatch({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Voice Chat Completions
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful response
 * @throws ApiError
 */
export const useVoiceServiceCreateVoiceChatCompletions = <
  TData = Common.VoiceServiceCreateVoiceChatCompletionsMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: { [key: string]: unknown };
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: { [key: string]: unknown };
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userAgent, userId, xProjectId }) =>
      VoiceService.createVoiceChatCompletions({
        agentId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create User
 * Create a new user in the database
 * @param data The data for the request.
 * @param data.requestBody
 * @returns User Successful Response
 * @throws ApiError
 */
export const useUsersServiceCreateUser = <
  TData = Common.UsersServiceCreateUserMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: UserCreate;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: UserCreate;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      UsersService.createUser({ requestBody }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Org
 * Create a new org in the database
 * @param data The data for the request.
 * @param data.requestBody
 * @returns Organization Successful Response
 * @throws ApiError
 */
export const useOrganizationServiceCreateOrganization = <
  TData = Common.OrganizationServiceCreateOrganizationMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: OrganizationCreate;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: OrganizationCreate;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      OrganizationService.createOrganization({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Authenticate User
 * Authenticates the user and sends response with User related data.
 *
 * Currently, this is a placeholder that simply returns a UUID placeholder
 * @param data The data for the request.
 * @param data.requestBody
 * @returns AuthResponse Successful Response
 * @throws ApiError
 */
export const useAuthServiceAuthenticateUserV1AuthPost = <
  TData = Common.AuthServiceAuthenticateUserV1AuthPostMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: AuthRequest;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: AuthRequest;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      AuthService.authenticateUserV1AuthPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upsert Tool
 * Create or update a tool
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceUpsertTool = <
  TData = Common.ToolsServiceUpsertToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ToolCreate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: ToolCreate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ToolsService.upsertTool({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Add Mcp Server To Config
 * Add a new MCP server to the Letta MCP server config
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceAddMcpServer = <
  TData = Common.ToolsServiceAddMcpServerMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody:
          | StdioServerConfig
          | SSEServerConfig
          | StreamableHTTPServerConfig;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody:
        | StdioServerConfig
        | SSEServerConfig
        | StreamableHTTPServerConfig;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProjectId }) =>
      ToolsService.addMcpServer({
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upsert Identity
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.xProject The project slug to associate with the identity (cloud only).
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Identity Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceUpsertIdentity = <
  TData = Common.IdentitiesServiceUpsertIdentityMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: IdentityUpsert;
        userAgent?: string;
        userId?: string;
        xProject?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: IdentityUpsert;
      userAgent?: string;
      userId?: string;
      xProject?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userAgent, userId, xProject, xProjectId }) =>
      IdentitiesService.upsertIdentity({
        requestBody,
        userAgent,
        userId,
        xProject,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upsert Identity Properties
 * @param data The data for the request.
 * @param data.identityId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceUpsertIdentityProperties = <
  TData = Common.IdentitiesServiceUpsertIdentityPropertiesMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        identityId: string;
        requestBody: IdentityProperty[];
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      identityId: string;
      requestBody: IdentityProperty[];
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ identityId, requestBody, userAgent, userId, xProjectId }) =>
      IdentitiesService.upsertIdentityProperties({
        identityId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update User
 * Update a user in the database
 * @param data The data for the request.
 * @param data.requestBody
 * @returns User Successful Response
 * @throws ApiError
 */
export const useAdminServiceUpdateUser = <
  TData = Common.AdminServiceUpdateUserMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: UserUpdate;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: UserUpdate;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      AdminService.updateUser({ requestBody }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update User
 * Update a user in the database
 * @param data The data for the request.
 * @param data.requestBody
 * @returns User Successful Response
 * @throws ApiError
 */
export const useUsersServiceUpdateUser = <
  TData = Common.UsersServiceUpdateUserMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: UserUpdate;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: UserUpdate;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      UsersService.updateUser({ requestBody }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Tool
 * Update an existing tool
 * @param data The data for the request.
 * @param data.toolId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceModifyTool = <
  TData = Common.ToolsServiceModifyToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ToolUpdate;
        toolId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: ToolUpdate;
      toolId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, toolId, userAgent, userId, xProjectId }) =>
      ToolsService.modifyTool({
        requestBody,
        toolId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Mcp Server
 * Update an existing MCP server configuration
 * @param data The data for the request.
 * @param data.mcpServerName
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceUpdateMcpServer = <
  TData = Common.ToolsServiceUpdateMcpServerMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        mcpServerName: string;
        requestBody:
          | UpdateStdioMCPServer
          | UpdateSSEMCPServer
          | UpdateStreamableHTTPMCPServer;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      mcpServerName: string;
      requestBody:
        | UpdateStdioMCPServer
        | UpdateSSEMCPServer
        | UpdateStreamableHTTPMCPServer;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      mcpServerName,
      requestBody,
      userAgent,
      userId,
      xProjectId,
    }) =>
      ToolsService.updateMcpServer({
        mcpServerName,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * @deprecated
 * Modify Source
 * Update the name or documentation of an existing data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceModifySource = <
  TData = Common.SourcesServiceModifySourceMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: SourceUpdate;
        sourceId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: SourceUpdate;
      sourceId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, sourceId, userAgent, userId, xProjectId }) =>
      SourcesService.modifySource({
        requestBody,
        sourceId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Folder
 * Update the name or documentation of an existing data folder.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Folder Successful Response
 * @throws ApiError
 */
export const useFoldersServiceModifyFolder = <
  TData = Common.FoldersServiceModifyFolderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        folderId: string;
        requestBody: SourceUpdate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      folderId: string;
      requestBody: SourceUpdate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ folderId, requestBody, userAgent, userId, xProjectId }) =>
      FoldersService.modifyFolder({
        folderId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Agent
 * Update an existing agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceModifyAgent = <
  TData = Common.AgentsServiceModifyAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: UpdateAgent;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: UpdateAgent;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userAgent, userId, xProjectId }) =>
      AgentsService.modifyAgent({
        agentId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Attach Tool
 * Attach a tool to an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.toolId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceAttachTool = <
  TData = Common.AgentsServiceAttachToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        toolId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      toolId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, toolId, userAgent, userId, xProjectId }) =>
      AgentsService.attachTool({
        agentId,
        toolId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Detach Tool
 * Detach a tool from an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.toolId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDetachTool = <
  TData = Common.AgentsServiceDetachToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        toolId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      toolId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, toolId, userAgent, userId, xProjectId }) =>
      AgentsService.detachTool({
        agentId,
        toolId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Approval
 * Attach a tool to an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.toolName
 * @param data.requiresApproval
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceModifyApproval = <
  TData = Common.AgentsServiceModifyApprovalMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requiresApproval: boolean;
        toolName: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requiresApproval: boolean;
      toolName: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      agentId,
      requiresApproval,
      toolName,
      userAgent,
      userId,
      xProjectId,
    }) =>
      AgentsService.modifyApproval({
        agentId,
        requiresApproval,
        toolName,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Attach Source
 * Attach a source to an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.sourceId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceAttachSourceToAgent = <
  TData = Common.AgentsServiceAttachSourceToAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        sourceId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      sourceId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, sourceId, userAgent, userId, xProjectId }) =>
      AgentsService.attachSourceToAgent({
        agentId,
        sourceId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Attach Folder To Agent
 * Attach a folder to an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.folderId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceAttachFolderToAgent = <
  TData = Common.AgentsServiceAttachFolderToAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        folderId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      folderId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, folderId, userAgent, userId, xProjectId }) =>
      AgentsService.attachFolderToAgent({
        agentId,
        folderId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Detach Source
 * Detach a source from an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.sourceId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDetachSourceFromAgent = <
  TData = Common.AgentsServiceDetachSourceFromAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        sourceId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      sourceId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, sourceId, userAgent, userId, xProjectId }) =>
      AgentsService.detachSourceFromAgent({
        agentId,
        sourceId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Detach Folder From Agent
 * Detach a folder from an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.folderId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDetachFolderFromAgent = <
  TData = Common.AgentsServiceDetachFolderFromAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        folderId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      folderId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, folderId, userAgent, userId, xProjectId }) =>
      AgentsService.detachFolderFromAgent({
        agentId,
        folderId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Close All Open Files
 * Closes all currently open files for a given agent.
 *
 * This endpoint updates the file state for the agent so that no files are marked as open.
 * Typically used to reset the working memory view for the agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns string Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCloseAllOpenFiles = <
  TData = Common.AgentsServiceCloseAllOpenFilesMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, userAgent, userId, xProjectId }) =>
      AgentsService.closeAllOpenFiles({
        agentId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Open File
 * Opens a specific file for a given agent.
 *
 * This endpoint marks a specific file as open in the agent's file state.
 * The file will be included in the agent's working memory view.
 * Returns a list of file names that were closed due to LRU eviction.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.fileId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns string Successful Response
 * @throws ApiError
 */
export const useAgentsServiceOpenFile = <
  TData = Common.AgentsServiceOpenFileMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        fileId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      fileId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, fileId, userAgent, userId, xProjectId }) =>
      AgentsService.openFile({
        agentId,
        fileId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Close File
 * Closes a specific file for a given agent.
 *
 * This endpoint marks a specific file as closed in the agent's file state.
 * The file will be removed from the agent's working memory view.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.fileId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCloseFile = <
  TData = Common.AgentsServiceCloseFileMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        fileId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      fileId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, fileId, userAgent, userId, xProjectId }) =>
      AgentsService.closeFile({
        agentId,
        fileId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Block
 * Updates a core memory block of an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockLabel
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useAgentsServiceModifyCoreMemoryBlock = <
  TData = Common.AgentsServiceModifyCoreMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        blockLabel: string;
        requestBody: BlockUpdate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      blockLabel: string;
      requestBody: BlockUpdate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      agentId,
      blockLabel,
      requestBody,
      userAgent,
      userId,
      xProjectId,
    }) =>
      AgentsService.modifyCoreMemoryBlock({
        agentId,
        blockLabel,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Attach Block
 * Attach a core memory block to an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceAttachCoreMemoryBlock = <
  TData = Common.AgentsServiceAttachCoreMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        blockId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      blockId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, blockId, userAgent, userId, xProjectId }) =>
      AgentsService.attachCoreMemoryBlock({
        agentId,
        blockId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Detach Block
 * Detach a core memory block from an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDetachCoreMemoryBlock = <
  TData = Common.AgentsServiceDetachCoreMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        blockId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      blockId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, blockId, userAgent, userId, xProjectId }) =>
      AgentsService.detachCoreMemoryBlock({
        agentId,
        blockId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Message
 * Update the details of a message associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.messageId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServiceModifyMessage = <
  TData = Common.AgentsServiceModifyMessageMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        messageId: string;
        requestBody:
          | UpdateSystemMessage
          | UpdateUserMessage
          | UpdateReasoningMessage
          | UpdateAssistantMessage;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      messageId: string;
      requestBody:
        | UpdateSystemMessage
        | UpdateUserMessage
        | UpdateReasoningMessage
        | UpdateAssistantMessage;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      agentId,
      messageId,
      requestBody,
      userAgent,
      userId,
      xProjectId,
    }) =>
      AgentsService.modifyMessage({
        agentId,
        messageId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Reset Messages
 * Resets the messages for an agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.addDefaultInitialMessages If true, adds the default initial messages after resetting.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceResetMessages = <
  TData = Common.AgentsServiceResetMessagesMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        addDefaultInitialMessages?: boolean;
        agentId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      addDefaultInitialMessages?: boolean;
      agentId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      addDefaultInitialMessages,
      agentId,
      userAgent,
      userId,
      xProjectId,
    }) =>
      AgentsService.resetMessages({
        addDefaultInitialMessages,
        agentId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Group
 * Create a new multi-agent group with the specified configuration.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.requestBody
 * @param data.xProject The project slug to associate with the group (cloud only).
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Group Successful Response
 * @throws ApiError
 */
export const useGroupsServiceModifyGroup = <
  TData = Common.GroupsServiceModifyGroupMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        groupId: string;
        requestBody: GroupUpdate;
        userAgent?: string;
        userId?: string;
        xProject?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      groupId: string;
      requestBody: GroupUpdate;
      userAgent?: string;
      userId?: string;
      xProject?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      groupId,
      requestBody,
      userAgent,
      userId,
      xProject,
      xProjectId,
    }) =>
      GroupsService.modifyGroup({
        groupId,
        requestBody,
        userAgent,
        userId,
        xProject,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Group Message
 * Update the details of a message associated with an agent.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.messageId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useGroupsServiceModifyGroupMessage = <
  TData = Common.GroupsServiceModifyGroupMessageMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        groupId: string;
        messageId: string;
        requestBody:
          | UpdateSystemMessage
          | UpdateUserMessage
          | UpdateReasoningMessage
          | UpdateAssistantMessage;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      groupId: string;
      messageId: string;
      requestBody:
        | UpdateSystemMessage
        | UpdateUserMessage
        | UpdateReasoningMessage
        | UpdateAssistantMessage;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({
      groupId,
      messageId,
      requestBody,
      userAgent,
      userId,
      xProjectId,
    }) =>
      GroupsService.modifyGroupMessage({
        groupId,
        messageId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Reset Group Messages
 * Delete the group messages for all agents that are part of the multi-agent group.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useGroupsServiceResetGroupMessages = <
  TData = Common.GroupsServiceResetGroupMessagesMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        groupId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      groupId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, userAgent, userId, xProjectId }) =>
      GroupsService.resetGroupMessages({
        groupId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Identity
 * @param data The data for the request.
 * @param data.identityId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Identity Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceUpdateIdentity = <
  TData = Common.IdentitiesServiceUpdateIdentityMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        identityId: string;
        requestBody: IdentityUpdate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      identityId: string;
      requestBody: IdentityUpdate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ identityId, requestBody, userAgent, userId, xProjectId }) =>
      IdentitiesService.updateIdentity({
        identityId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceModifyBlock = <
  TData = Common.BlocksServiceModifyBlockMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        blockId: string;
        requestBody: BlockUpdate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      blockId: string;
      requestBody: BlockUpdate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ blockId, requestBody, userAgent, userId, xProjectId }) =>
      BlocksService.modifyBlock({
        blockId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Cancel Job
 * Cancel a job by its job_id.
 *
 * This endpoint marks a job as cancelled, which will cause any associated
 * agent execution to terminate as soon as possible.
 * @param data The data for the request.
 * @param data.jobId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceCancelJob = <
  TData = Common.JobsServiceCancelJobMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        jobId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      jobId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ jobId, userAgent, userId, xProjectId }) =>
      JobsService.cancelJob({
        jobId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Sandbox Config
 * @param data The data for the request.
 * @param data.sandboxConfigId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns SandboxConfig Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceUpdateSandboxConfigV1SandboxConfigSandboxConfigIdPatch =
  <
    TData = Common.SandboxConfigServiceUpdateSandboxConfigV1SandboxConfigSandboxConfigIdPatchMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          requestBody: SandboxConfigUpdate;
          sandboxConfigId: string;
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        requestBody: SandboxConfigUpdate;
        sandboxConfigId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({
        requestBody,
        sandboxConfigId,
        userAgent,
        userId,
        xProjectId,
      }) =>
        SandboxConfigService.updateSandboxConfigV1SandboxConfigSandboxConfigIdPatch(
          { requestBody, sandboxConfigId, userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Update Sandbox Env Var
 * @param data The data for the request.
 * @param data.envVarId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns SandboxEnvironmentVariable Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceUpdateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatch =
  <
    TData = Common.SandboxConfigServiceUpdateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatchMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          envVarId: string;
          requestBody: SandboxEnvironmentVariableUpdate;
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        envVarId: string;
        requestBody: SandboxEnvironmentVariableUpdate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({ envVarId, requestBody, userAgent, userId, xProjectId }) =>
        SandboxConfigService.updateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatch(
          { envVarId, requestBody, userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Modify Provider
 * Update an existing custom provider.
 * @param data The data for the request.
 * @param data.providerId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Provider Successful Response
 * @throws ApiError
 */
export const useProvidersServiceModifyProvider = <
  TData = Common.ProvidersServiceModifyProviderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        providerId: string;
        requestBody: ProviderUpdate;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      providerId: string;
      requestBody: ProviderUpdate;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ providerId, requestBody, userAgent, userId, xProjectId }) =>
      ProvidersService.modifyProvider({
        providerId,
        requestBody,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Feedback For Step
 * Modify feedback for a given step.
 * @param data The data for the request.
 * @param data.stepId
 * @param data.requestBody
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Step Successful Response
 * @throws ApiError
 */
export const useStepsServiceModifyFeedbackForStep = <
  TData = Common.StepsServiceModifyFeedbackForStepMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ModifyFeedbackRequest;
        stepId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: ModifyFeedbackRequest;
      stepId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, stepId, userAgent, userId, xProjectId }) =>
      StepsService.modifyFeedbackForStep({
        requestBody,
        stepId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Step Transaction Id
 * Update the transaction ID for a step.
 * @param data The data for the request.
 * @param data.stepId
 * @param data.transactionId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Step Successful Response
 * @throws ApiError
 */
export const useStepsServiceUpdateStepTransactionId = <
  TData = Common.StepsServiceUpdateStepTransactionIdMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        stepId: string;
        transactionId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      stepId: string;
      transactionId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ stepId, transactionId, userAgent, userId, xProjectId }) =>
      StepsService.updateStepTransactionId({
        stepId,
        transactionId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Org
 * @param data The data for the request.
 * @param data.orgId The org_id key to be updated.
 * @param data.requestBody
 * @returns Organization Successful Response
 * @throws ApiError
 */
export const useAdminServiceUpdateOrganization = <
  TData = Common.AdminServiceUpdateOrganizationMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        orgId: string;
        requestBody: OrganizationUpdate;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      orgId: string;
      requestBody: OrganizationUpdate;
    },
    TContext
  >({
    mutationFn: ({ orgId, requestBody }) =>
      AdminService.updateOrganization({
        orgId,
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Cancel Batch
 * Cancel a batch run.
 * @param data The data for the request.
 * @param data.batchId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useMessagesServiceCancelBatch = <
  TData = Common.MessagesServiceCancelBatchMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        batchId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      batchId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ batchId, userAgent, userId, xProjectId }) =>
      MessagesService.cancelBatch({
        batchId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Org
 * @param data The data for the request.
 * @param data.orgId The org_id key to be updated.
 * @param data.requestBody
 * @returns Organization Successful Response
 * @throws ApiError
 */
export const useOrganizationServiceUpdateOrganization = <
  TData = Common.OrganizationServiceUpdateOrganizationMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        orgId: string;
        requestBody: OrganizationUpdate;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      orgId: string;
      requestBody: OrganizationUpdate;
    },
    TContext
  >({
    mutationFn: ({ orgId, requestBody }) =>
      OrganizationService.updateOrganization({
        orgId,
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Tool
 * Delete a tool by name
 * @param data The data for the request.
 * @param data.toolId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceDeleteTool = <
  TData = Common.ToolsServiceDeleteToolMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        toolId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      toolId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ toolId, userAgent, userId, xProjectId }) =>
      ToolsService.deleteTool({
        toolId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Mcp Server From Config
 * Delete a MCP server configuration
 * @param data The data for the request.
 * @param data.mcpServerName
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceDeleteMcpServer = <
  TData = Common.ToolsServiceDeleteMcpServerMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        mcpServerName: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      mcpServerName: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ mcpServerName, userAgent, userId, xProjectId }) =>
      ToolsService.deleteMcpServer({
        mcpServerName,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * @deprecated
 * Delete Source
 * Delete a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useSourcesServiceDeleteSource = <
  TData = Common.SourcesServiceDeleteSourceMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        sourceId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      sourceId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ sourceId, userAgent, userId, xProjectId }) =>
      SourcesService.deleteSource({
        sourceId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * @deprecated
 * Delete File From Source
 * Delete a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.fileId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns void Successful Response
 * @throws ApiError
 */
export const useSourcesServiceDeleteFileFromSource = <
  TData = Common.SourcesServiceDeleteFileFromSourceMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        fileId: string;
        sourceId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      fileId: string;
      sourceId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ fileId, sourceId, userAgent, userId, xProjectId }) =>
      SourcesService.deleteFileFromSource({
        fileId,
        sourceId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Folder
 * Delete a data folder.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useFoldersServiceDeleteFolder = <
  TData = Common.FoldersServiceDeleteFolderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        folderId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      folderId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ folderId, userAgent, userId, xProjectId }) =>
      FoldersService.deleteFolder({
        folderId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete File From Folder
 * Delete a file from a folder.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.fileId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns void Successful Response
 * @throws ApiError
 */
export const useFoldersServiceDeleteFileFromFolder = <
  TData = Common.FoldersServiceDeleteFileFromFolderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        fileId: string;
        folderId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      fileId: string;
      folderId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ fileId, folderId, userAgent, userId, xProjectId }) =>
      FoldersService.deleteFileFromFolder({
        fileId,
        folderId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Agent
 * Delete an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDeleteAgent = <
  TData = Common.AgentsServiceDeleteAgentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, userAgent, userId, xProjectId }) =>
      AgentsService.deleteAgent({
        agentId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Passage
 * Delete a memory from an agent's archival memory store.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.memoryId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDeletePassage = <
  TData = Common.AgentsServiceDeletePassageMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        memoryId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      memoryId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, memoryId, userAgent, userId, xProjectId }) =>
      AgentsService.deletePassage({
        agentId,
        memoryId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Group
 * Delete a multi-agent group.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useGroupsServiceDeleteGroup = <
  TData = Common.GroupsServiceDeleteGroupMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        groupId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      groupId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, userAgent, userId, xProjectId }) =>
      GroupsService.deleteGroup({
        groupId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Identity
 * Delete an identity by its identifier key
 * @param data The data for the request.
 * @param data.identityId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceDeleteIdentity = <
  TData = Common.IdentitiesServiceDeleteIdentityMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        identityId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      identityId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ identityId, userAgent, userId, xProjectId }) =>
      IdentitiesService.deleteIdentity({
        identityId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Deployment
 * Delete all entities (blocks, agents, groups) with the specified deployment_id.
 * Deletion order: blocks -> agents -> groups to maintain referential integrity.
 * @param data The data for the request.
 * @param data.deploymentId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns DeleteDeploymentResponse Successful Response
 * @throws ApiError
 */
export const useInternalTemplatesServiceDeleteDeployment = <
  TData = Common.InternalTemplatesServiceDeleteDeploymentMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        deploymentId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      deploymentId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ deploymentId, userAgent, userId, xProjectId }) =>
      InternalTemplatesService.deleteDeployment({
        deploymentId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useBlocksServiceDeleteBlock = <
  TData = Common.BlocksServiceDeleteBlockMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        blockId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      blockId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ blockId, userAgent, userId, xProjectId }) =>
      BlocksService.deleteBlock({
        blockId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Job
 * Delete a job by its job_id.
 * @param data The data for the request.
 * @param data.jobId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceDeleteJob = <
  TData = Common.JobsServiceDeleteJobMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        jobId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      jobId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ jobId, userAgent, userId, xProjectId }) =>
      JobsService.deleteJob({
        jobId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Sandbox Config
 * @param data The data for the request.
 * @param data.sandboxConfigId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns void Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceDeleteSandboxConfigV1SandboxConfigSandboxConfigIdDelete =
  <
    TData = Common.SandboxConfigServiceDeleteSandboxConfigV1SandboxConfigSandboxConfigIdDeleteMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          sandboxConfigId: string;
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        sandboxConfigId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({ sandboxConfigId, userAgent, userId, xProjectId }) =>
        SandboxConfigService.deleteSandboxConfigV1SandboxConfigSandboxConfigIdDelete(
          { sandboxConfigId, userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Delete Sandbox Env Var
 * @param data The data for the request.
 * @param data.envVarId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns void Successful Response
 * @throws ApiError
 */
export const useSandboxConfigServiceDeleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDelete =
  <
    TData = Common.SandboxConfigServiceDeleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDeleteMutationResult,
    TError = unknown,
    TContext = unknown,
  >(
    options?: Omit<
      UseMutationOptions<
        TData,
        TError,
        {
          envVarId: string;
          userAgent?: string;
          userId?: string;
          xProjectId?: string;
        },
        TContext
      >,
      'mutationFn'
    >,
  ) =>
    useMutation<
      TData,
      TError,
      {
        envVarId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >({
      mutationFn: ({ envVarId, userAgent, userId, xProjectId }) =>
        SandboxConfigService.deleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDelete(
          { envVarId, userAgent, userId, xProjectId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Delete Provider
 * Delete an existing custom provider.
 * @param data The data for the request.
 * @param data.providerId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useProvidersServiceDeleteProvider = <
  TData = Common.ProvidersServiceDeleteProviderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        providerId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      providerId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ providerId, userAgent, userId, xProjectId }) =>
      ProvidersService.deleteProvider({
        providerId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Run
 * Delete a run by its run_id.
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceDeleteRun = <
  TData = Common.RunsServiceDeleteRunMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        runId: string;
        userAgent?: string;
        userId?: string;
        xProjectId?: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      runId: string;
      userAgent?: string;
      userId?: string;
      xProjectId?: string;
    },
    TContext
  >({
    mutationFn: ({ runId, userAgent, userId, xProjectId }) =>
      RunsService.deleteRun({
        runId,
        userAgent,
        userId,
        xProjectId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete User
 * @param data The data for the request.
 * @param data.userId The user_id key to be deleted.
 * @returns User Successful Response
 * @throws ApiError
 */
export const useAdminServiceDeleteUser = <
  TData = Common.AdminServiceDeleteUserMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        userId: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      userId: string;
    },
    TContext
  >({
    mutationFn: ({ userId }) =>
      AdminService.deleteUser({ userId }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Org
 * @param data The data for the request.
 * @param data.orgId The org_id key to be deleted.
 * @returns Organization Successful Response
 * @throws ApiError
 */
export const useAdminServiceDeleteOrganizationById = <
  TData = Common.AdminServiceDeleteOrganizationByIdMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        orgId: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      orgId: string;
    },
    TContext
  >({
    mutationFn: ({ orgId }) =>
      AdminService.deleteOrganizationById({
        orgId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete User
 * @param data The data for the request.
 * @param data.userId The user_id key to be deleted.
 * @returns User Successful Response
 * @throws ApiError
 */
export const useUsersServiceDeleteUser = <
  TData = Common.UsersServiceDeleteUserMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        userId: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      userId: string;
    },
    TContext
  >({
    mutationFn: ({ userId }) =>
      UsersService.deleteUser({ userId }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Org
 * @param data The data for the request.
 * @param data.orgId The org_id key to be deleted.
 * @returns Organization Successful Response
 * @throws ApiError
 */
export const useOrganizationServiceDeleteOrganizationById = <
  TData = Common.OrganizationServiceDeleteOrganizationByIdMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        orgId: string;
      },
      TContext
    >,
    'mutationFn'
  >,
) =>
  useMutation<
    TData,
    TError,
    {
      orgId: string;
    },
    TContext
  >({
    mutationFn: ({ orgId }) =>
      OrganizationService.deleteOrganizationById({
        orgId,
      }) as unknown as Promise<TData>,
    ...options,
  });

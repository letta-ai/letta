// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { type QueryClient } from '@tanstack/react-query';
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
export const prefetchUseArchivesServiceListArchives = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseArchivesServiceListArchivesKeyFn({
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
    }),
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
      }),
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
export const prefetchUseToolsServiceRetrieveTool = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceRetrieveToolKeyFn({
      toolId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      ToolsService.retrieveTool({
        toolId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseToolsServiceCountTools = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceCountToolsKeyFn({
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
    }),
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
      }),
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
export const prefetchUseToolsServiceListTools = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListToolsKeyFn({
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
    }),
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
      }),
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
export const prefetchUseToolsServiceListMcpServers = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListMcpServersKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      ToolsService.listMcpServers({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseToolsServiceListMcpToolsByServer = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListMcpToolsByServerKeyFn({
      mcpServerName,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      ToolsService.listMcpToolsByServer({
        mcpServerName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseToolsServiceMcpOauthCallback = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceMcpOauthCallbackKeyFn({
      code,
      error,
      errorDescription,
      sessionId,
      state,
    }),
    queryFn: () =>
      ToolsService.mcpOauthCallback({
        code,
        error,
        errorDescription,
        sessionId,
        state,
      }),
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
export const prefetchUseSourcesServiceCountSources = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceCountSourcesKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      SourcesService.countSources({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseSourcesServiceRetrieveSource = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceRetrieveSourceKeyFn({
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      SourcesService.retrieveSource({
        sourceId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseSourcesServiceGetSourceIdByName = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn({
      sourceName,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      SourcesService.getSourceIdByName({
        sourceName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseSourcesServiceGetSourcesMetadata = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourcesMetadataKeyFn({
      includeDetailedPerSourceMetadata,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      SourcesService.getSourcesMetadata({
        includeDetailedPerSourceMetadata,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseSourcesServiceListSources = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      SourcesService.listSources({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseSourcesServiceGetAgentsForSource = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetAgentsForSourceKeyFn({
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      SourcesService.getAgentsForSource({
        sourceId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseSourcesServiceListSourcePassages = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn({
      after,
      before,
      limit,
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
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
      }),
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
export const prefetchUseSourcesServiceListSourceFiles = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourceFilesKeyFn({
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
    }),
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
      }),
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
export const prefetchUseSourcesServiceGetFileMetadata = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetFileMetadataKeyFn({
      fileId,
      includeContent,
      sourceId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
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
      }),
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
export const prefetchUseFoldersServiceCountFolders = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceCountFoldersKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      FoldersService.countFolders({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseFoldersServiceRetrieveFolder = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceRetrieveFolderKeyFn({
      folderId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      FoldersService.retrieveFolder({
        folderId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseFoldersServiceGetFolderByName = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceGetFolderByNameKeyFn({
      folderName,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      FoldersService.getFolderByName({
        folderName,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseFoldersServiceRetrieveMetadata = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceRetrieveMetadataKeyFn({
      includeDetailedPerSourceMetadata,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      FoldersService.retrieveMetadata({
        includeDetailedPerSourceMetadata,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseFoldersServiceListFolders = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceListFoldersKeyFn({
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
    }),
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
      }),
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
export const prefetchUseFoldersServiceListAgentsForFolder = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceListAgentsForFolderKeyFn({
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
    }),
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
      }),
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
export const prefetchUseFoldersServiceListFolderPassages = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceListFolderPassagesKeyFn({
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
    }),
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
      }),
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
export const prefetchUseFoldersServiceListFolderFiles = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceListFolderFilesKeyFn({
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
    }),
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
      }),
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
export const prefetchUseAgentsServiceListAgents = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn({
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
    }),
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
      }),
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
export const prefetchUseAgentsServiceCountAgents = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceCountAgentsKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.countAgents({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseAgentsServiceExportAgent = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceExportAgentKeyFn({
      agentId,
      maxSteps,
      requestBody,
      useLegacyFormat,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
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
      }),
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
export const prefetchUseAgentsServiceRetrieveAgentContextWindow = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceRetrieveAgentContextWindowKeyFn({
      agentId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.retrieveAgentContextWindow({
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseAgentsServiceRetrieveAgent = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceRetrieveAgentKeyFn({
      agentId,
      includeRelationships,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.retrieveAgent({
        agentId,
        includeRelationships,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
  });
/**
 * List Agent Tools
 * Get tools from an existing agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.before Tool ID cursor for pagination. Returns tools that come before this tool ID in the specified sort order
 * @param data.after Tool ID cursor for pagination. Returns tools that come after this tool ID in the specified sort order
 * @param data.limit Maximum number of tools to return
 * @param data.order Sort order for tools by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListAgentTools = (
  queryClient: QueryClient,
  {
    after,
    agentId,
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
    agentId: string;
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentToolsKeyFn({
      after,
      agentId,
      before,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.listAgentTools({
        after,
        agentId,
        before,
        limit,
        order,
        orderBy,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
  });
/**
 * List Agent Sources
 * Get the sources associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.before Source ID cursor for pagination. Returns sources that come before this source ID in the specified sort order
 * @param data.after Source ID cursor for pagination. Returns sources that come after this source ID in the specified sort order
 * @param data.limit Maximum number of sources to return
 * @param data.order Sort order for sources by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Source Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListAgentSources = (
  queryClient: QueryClient,
  {
    after,
    agentId,
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
    agentId: string;
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentSourcesKeyFn({
      after,
      agentId,
      before,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.listAgentSources({
        after,
        agentId,
        before,
        limit,
        order,
        orderBy,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
  });
/**
 * List Agent Folders
 * Get the folders associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.before Source ID cursor for pagination. Returns sources that come before this source ID in the specified sort order
 * @param data.after Source ID cursor for pagination. Returns sources that come after this source ID in the specified sort order
 * @param data.limit Maximum number of sources to return
 * @param data.order Sort order for sources by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Source Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListAgentFolders = (
  queryClient: QueryClient,
  {
    after,
    agentId,
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
    agentId: string;
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentFoldersKeyFn({
      after,
      agentId,
      before,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.listAgentFolders({
        after,
        agentId,
        before,
        limit,
        order,
        orderBy,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseAgentsServiceListAgentFiles = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentFilesKeyFn({
      agentId,
      cursor,
      isOpen,
      limit,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
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
      }),
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
export const prefetchUseAgentsServiceRetrieveAgentMemory = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceRetrieveAgentMemoryKeyFn({
      agentId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.retrieveAgentMemory({
        agentId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseAgentsServiceRetrieveCoreMemoryBlock = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceRetrieveCoreMemoryBlockKeyFn({
      agentId,
      blockLabel,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.retrieveCoreMemoryBlock({
        agentId,
        blockLabel,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
  });
/**
 * List Blocks
 * Retrieve the core memory blocks of a specific agent.
 * @param data The data for the request.
 * @param data.agentId
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
export const prefetchUseAgentsServiceListCoreMemoryBlocks = (
  queryClient: QueryClient,
  {
    after,
    agentId,
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
    agentId: string;
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListCoreMemoryBlocksKeyFn({
      after,
      agentId,
      before,
      limit,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.listCoreMemoryBlocks({
        after,
        agentId,
        before,
        limit,
        order,
        orderBy,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseAgentsServiceListPassages = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListPassagesKeyFn({
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
    }),
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
      }),
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
export const prefetchUseAgentsServiceSearchArchivalMemory = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceSearchArchivalMemoryKeyFn({
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
    }),
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
      }),
  });
/**
 * List Messages
 * Retrieve message history for an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.before Message ID cursor for pagination. Returns messages that come before this message ID in the specified sort order
 * @param data.after Message ID cursor for pagination. Returns messages that come after this message ID in the specified sort order
 * @param data.limit Maximum number of messages to return
 * @param data.order Sort order for messages by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
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
export const prefetchUseAgentsServiceListMessages = (
  queryClient: QueryClient,
  {
    after,
    agentId,
    assistantMessageToolKwarg,
    assistantMessageToolName,
    before,
    groupId,
    includeErr,
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
    agentId: string;
    assistantMessageToolKwarg?: string;
    assistantMessageToolName?: string;
    before?: string;
    groupId?: string;
    includeErr?: boolean;
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListMessagesKeyFn({
      after,
      agentId,
      assistantMessageToolKwarg,
      assistantMessageToolName,
      before,
      groupId,
      includeErr,
      limit,
      order,
      orderBy,
      useAssistantMessage,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
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
        order,
        orderBy,
        useAssistantMessage,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
  });
/**
 * List Agent Groups
 * Lists the groups for an agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.managerType Manager type to filter groups by
 * @param data.before Group ID cursor for pagination. Returns groups that come before this group ID in the specified sort order
 * @param data.after Group ID cursor for pagination. Returns groups that come after this group ID in the specified sort order
 * @param data.limit Maximum number of groups to return
 * @param data.order Sort order for groups by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Group Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListAgentGroups = (
  queryClient: QueryClient,
  {
    after,
    agentId,
    before,
    limit,
    managerType,
    order,
    orderBy,
    userAgent,
    userId,
    xExperimentalLettaV1Agent,
    xExperimentalMessageAsync,
    xProjectId,
  }: {
    after?: string;
    agentId: string;
    before?: string;
    limit?: number;
    managerType?: string;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userAgent?: string;
    userId?: string;
    xExperimentalLettaV1Agent?: string;
    xExperimentalMessageAsync?: string;
    xProjectId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentGroupsKeyFn({
      after,
      agentId,
      before,
      limit,
      managerType,
      order,
      orderBy,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      AgentsService.listAgentGroups({
        after,
        agentId,
        before,
        limit,
        managerType,
        order,
        orderBy,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseGroupsServiceListGroups = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGroupsServiceListGroupsKeyFn({
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
    }),
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
      }),
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
export const prefetchUseGroupsServiceCountGroups = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGroupsServiceCountGroupsKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      GroupsService.countGroups({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseGroupsServiceRetrieveGroup = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGroupsServiceRetrieveGroupKeyFn({
      groupId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      GroupsService.retrieveGroup({
        groupId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseGroupsServiceListGroupMessages = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGroupsServiceListGroupMessagesKeyFn({
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
    }),
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
      }),
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
export const prefetchUseIdentitiesServiceListIdentities = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseIdentitiesServiceListIdentitiesKeyFn({
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
    }),
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
      }),
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
export const prefetchUseIdentitiesServiceCountIdentities = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseIdentitiesServiceCountIdentitiesKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      IdentitiesService.countIdentities({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseIdentitiesServiceRetrieveIdentity = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseIdentitiesServiceRetrieveIdentityKeyFn({
      identityId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      IdentitiesService.retrieveIdentity({
        identityId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseIdentitiesServiceListAgentsForIdentity = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseIdentitiesServiceListAgentsForIdentityKeyFn({
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
    }),
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
      }),
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
export const prefetchUseIdentitiesServiceListBlocksForIdentity = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseIdentitiesServiceListBlocksForIdentityKeyFn({
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
    }),
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
      }),
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
export const prefetchUseInternalTemplatesServiceListDeploymentEntities = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseInternalTemplatesServiceListDeploymentEntitiesKeyFn({
      deploymentId,
      entityTypes,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      InternalTemplatesService.listDeploymentEntities({
        deploymentId,
        entityTypes,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseModelsServiceListModels = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListModelsKeyFn({
      providerCategory,
      providerName,
      providerType,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
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
      }),
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
export const prefetchUseModelsServiceListEmbeddingModels = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      ModelsService.listEmbeddingModels({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseLlmsServiceListModels = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseLlmsServiceListModelsKeyFn({
      providerCategory,
      providerName,
      providerType,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
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
      }),
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
export const prefetchUseLlmsServiceListEmbeddingModels = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      LlmsService.listEmbeddingModels({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseBlocksServiceListBlocks = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceListBlocksKeyFn({
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
    }),
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
      }),
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
export const prefetchUseBlocksServiceCountBlocks = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceCountBlocksKeyFn({
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      BlocksService.countBlocks({
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseBlocksServiceRetrieveBlock = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceRetrieveBlockKeyFn({
      blockId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      BlocksService.retrieveBlock({
        blockId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseBlocksServiceListAgentsForBlock = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceListAgentsForBlockKeyFn({
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
    }),
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
      }),
  });
/**
 * List Jobs
 * List all jobs.
 * @param data The data for the request.
 * @param data.sourceId Only list jobs associated with the source.
 * @param data.before Job ID cursor for pagination. Returns jobs that come before this job ID in the specified sort order
 * @param data.after Job ID cursor for pagination. Returns jobs that come after this job ID in the specified sort order
 * @param data.limit Maximum number of jobs to return
 * @param data.order Sort order for jobs by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.active Filter for active jobs.
 * @param data.ascending Whether to sort jobs oldest to newest (True, default) or newest to oldest (False). Deprecated in favor of order field.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Job Successful Response
 * @throws ApiError
 */
export const prefetchUseJobsServiceListJobs = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListJobsKeyFn({
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
    }),
    queryFn: () =>
      JobsService.listJobs({
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
      }),
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
export const prefetchUseJobsServiceListActiveJobs = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn({
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
    }),
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
      }),
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
export const prefetchUseJobsServiceRetrieveJob = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceRetrieveJobKeyFn({
      jobId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      JobsService.retrieveJob({
        jobId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
  });
/**
 * Check Health
 * @returns Health Successful Response
 * @throws ApiError
 */
export const prefetchUseHealthServiceCheckHealth = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseHealthServiceCheckHealthKeyFn(),
    queryFn: () => HealthService.checkHealth(),
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
export const prefetchUseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGet =
  (
    queryClient: QueryClient,
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
  ) =>
    queryClient.prefetchQuery({
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
        }),
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
export const prefetchUseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet =
  (
    queryClient: QueryClient,
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
  ) =>
    queryClient.prefetchQuery({
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
        ),
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
export const prefetchUseProvidersServiceListProviders = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseProvidersServiceListProvidersKeyFn({
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
    }),
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
      }),
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
export const prefetchUseProvidersServiceRetrieveProvider = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseProvidersServiceRetrieveProviderKeyFn({
      providerId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      ProvidersService.retrieveProvider({
        providerId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
  });
/**
 * List Runs
 * List all runs.
 * @param data The data for the request.
 * @param data.agentId The unique identifier of the agent associated with the run.
 * @param data.agentIds The unique identifiers of the agents associated with the run. Deprecated in favor of agent_id field.
 * @param data.background If True, filters for runs that were created in background mode.
 * @param data.stopReason Filter runs by stop reason.
 * @param data.before Run ID cursor for pagination. Returns runs that come before this run ID in the specified sort order
 * @param data.after Run ID cursor for pagination. Returns runs that come after this run ID in the specified sort order
 * @param data.limit Maximum number of runs to return
 * @param data.order Sort order for runs by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.active Filter for active runs.
 * @param data.ascending Whether to sort agents oldest to newest (True) or newest to oldest (False, default). Deprecated in favor of order field.
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Run Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceListRuns = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListRunsKeyFn({
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
    }),
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
        order,
        orderBy,
        stopReason,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseRunsServiceListActiveRuns = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListActiveRunsKeyFn({
      agentId,
      background,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      RunsService.listActiveRuns({
        agentId,
        background,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseRunsServiceRetrieveRun = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceRetrieveRunKeyFn({
      runId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      RunsService.retrieveRun({
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns LettaMessageUnion Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceListRunMessages = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListRunMessagesKeyFn({
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
    }),
    queryFn: () =>
      RunsService.listRunMessages({
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
      }),
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
export const prefetchUseRunsServiceRetrieveRunUsage = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceRetrieveRunUsageKeyFn({
      runId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      RunsService.retrieveRunUsage({
        runId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
  });
/**
 * List Run Steps
 * Get steps associated with a run with filtering options.
 * @param data The data for the request.
 * @param data.runId
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Maximum number of messages to return
 * @param data.order Sort order for steps by creation time. 'asc' for oldest first, 'desc' for newest first
 * @param data.orderBy Field to sort by
 * @param data.userId
 * @param data.userAgent
 * @param data.xProjectId
 * @param data.xExperimentalMessageAsync
 * @param data.xExperimentalLettaV1Agent
 * @returns Step Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceListRunSteps = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListRunStepsKeyFn({
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
    }),
    queryFn: () =>
      RunsService.listRunSteps({
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
      }),
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
export const prefetchUseStepsServiceListSteps = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseStepsServiceListStepsKeyFn({
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
    }),
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
      }),
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
export const prefetchUseStepsServiceRetrieveStep = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseStepsServiceRetrieveStepKeyFn({
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      StepsService.retrieveStep({
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseStepsServiceRetrieveMetricsForStep = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseStepsServiceRetrieveMetricsForStepKeyFn({
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      StepsService.retrieveMetricsForStep({
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseStepsServiceRetrieveTraceForStep = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseStepsServiceRetrieveTraceForStepKeyFn({
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      StepsService.retrieveTraceForStep({
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseStepsServiceListMessagesForStep = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseStepsServiceListMessagesForStepKeyFn({
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
    }),
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
      }),
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
export const prefetchUseTagServiceListTags = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseTagServiceListTagsKeyFn({
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
    }),
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
      }),
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
export const prefetchUseAdminServiceListTags = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListTagsKeyFn({
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
    }),
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
      }),
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
export const prefetchUseAdminServiceListUsers = (
  queryClient: QueryClient,
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListUsersKeyFn({ after, limit }),
    queryFn: () => AdminService.listUsers({ after, limit }),
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
export const prefetchUseAdminServiceListOrgs = (
  queryClient: QueryClient,
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListOrgsKeyFn({ after, limit }),
    queryFn: () => AdminService.listOrgs({ after, limit }),
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
export const prefetchUseTelemetryServiceRetrieveProviderTrace = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseTelemetryServiceRetrieveProviderTraceKeyFn({
      stepId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      TelemetryService.retrieveProviderTrace({
        stepId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseMessagesServiceListBatches = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseMessagesServiceListBatchesKeyFn({
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
    }),
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
      }),
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
export const prefetchUseMessagesServiceRetrieveBatch = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseMessagesServiceRetrieveBatchKeyFn({
      batchId,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      MessagesService.retrieveBatch({
        batchId,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseMessagesServiceListMessagesForBatch = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseMessagesServiceListMessagesForBatchKeyFn({
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
    }),
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
      }),
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
export const prefetchUseEmbeddingsServiceGetTotalStorageSize = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseEmbeddingsServiceGetTotalStorageSizeKeyFn({
      storageUnit,
      userAgent,
      userId,
      xExperimentalLettaV1Agent,
      xExperimentalMessageAsync,
      xProjectId,
    }),
    queryFn: () =>
      EmbeddingsService.getTotalStorageSize({
        storageUnit,
        userAgent,
        userId,
        xExperimentalLettaV1Agent,
        xExperimentalMessageAsync,
        xProjectId,
      }),
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
export const prefetchUseUsersServiceListUsers = (
  queryClient: QueryClient,
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseUsersServiceListUsersKeyFn({ after, limit }),
    queryFn: () => UsersService.listUsers({ after, limit }),
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
export const prefetchUseOrganizationServiceListOrgs = (
  queryClient: QueryClient,
  {
    after,
    limit,
  }: {
    after?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseOrganizationServiceListOrgsKeyFn({ after, limit }),
    queryFn: () => OrganizationService.listOrgs({ after, limit }),
  });

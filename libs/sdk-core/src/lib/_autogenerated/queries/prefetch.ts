// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { type QueryClient } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
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
} from '../requests/types.gen';
import * as Common from './common';
/**
 * Retrieve Tool
 * Get a tool by ID
 * @param data The data for the request.
 * @param data.toolId
 * @param data.userId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const prefetchUseToolsServiceRetrieveTool = (
  queryClient: QueryClient,
  {
    toolId,
    userId,
  }: {
    toolId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceRetrieveToolKeyFn({ toolId, userId }),
    queryFn: () => ToolsService.retrieveTool({ toolId, userId }),
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
    userId,
  }: {
    excludeLettaTools?: boolean;
    excludeToolTypes?: string[];
    name?: string;
    names?: string[];
    returnOnlyLettaTools?: boolean;
    search?: string;
    toolIds?: string[];
    toolTypes?: string[];
    userId?: string;
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
      userId,
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
        userId,
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
    userId,
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
    userId?: string;
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
      userId,
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
        userId,
      }),
  });
/**
 * List Composio Apps
 * Get a list of all Composio apps
 * @param data The data for the request.
 * @param data.userId
 * @returns AppModel Successful Response
 * @throws ApiError
 */
export const prefetchUseToolsServiceListComposioApps = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListComposioAppsKeyFn({ userId }),
    queryFn: () => ToolsService.listComposioApps({ userId }),
  });
/**
 * List Composio Actions By App
 * Get a list of all Composio actions for a specific app
 * @param data The data for the request.
 * @param data.composioAppName
 * @param data.userId
 * @returns ActionModel Successful Response
 * @throws ApiError
 */
export const prefetchUseToolsServiceListComposioActionsByApp = (
  queryClient: QueryClient,
  {
    composioAppName,
    userId,
  }: {
    composioAppName: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListComposioActionsByAppKeyFn({
      composioAppName,
      userId,
    }),
    queryFn: () =>
      ToolsService.listComposioActionsByApp({ composioAppName, userId }),
  });
/**
 * List Mcp Servers
 * Get a list of all configured MCP servers
 * @param data The data for the request.
 * @param data.userId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const prefetchUseToolsServiceListMcpServers = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListMcpServersKeyFn({ userId }),
    queryFn: () => ToolsService.listMcpServers({ userId }),
  });
/**
 * List Mcp Tools By Server
 * Get a list of all tools for a specific MCP server
 * @param data The data for the request.
 * @param data.mcpServerName
 * @param data.userId
 * @returns MCPTool Successful Response
 * @throws ApiError
 */
export const prefetchUseToolsServiceListMcpToolsByServer = (
  queryClient: QueryClient,
  {
    mcpServerName,
    userId,
  }: {
    mcpServerName: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListMcpToolsByServerKeyFn({
      mcpServerName,
      userId,
    }),
    queryFn: () => ToolsService.listMcpToolsByServer({ mcpServerName, userId }),
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
 * Count Sources
 * Count all data sources created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceCountSources = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceCountSourcesKeyFn({ userId }),
    queryFn: () => SourcesService.countSources({ userId }),
  });
/**
 * Retrieve Source
 * Get all sources
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceRetrieveSource = (
  queryClient: QueryClient,
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceRetrieveSourceKeyFn({ sourceId, userId }),
    queryFn: () => SourcesService.retrieveSource({ sourceId, userId }),
  });
/**
 * Get Source Id By Name
 * Get a source by name
 * @param data The data for the request.
 * @param data.sourceName
 * @param data.userId
 * @returns string Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceGetSourceIdByName = (
  queryClient: QueryClient,
  {
    sourceName,
    userId,
  }: {
    sourceName: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn({
      sourceName,
      userId,
    }),
    queryFn: () => SourcesService.getSourceIdByName({ sourceName, userId }),
  });
/**
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
 * @returns OrganizationSourcesStats Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceGetSourcesMetadata = (
  queryClient: QueryClient,
  {
    includeDetailedPerSourceMetadata,
    userId,
  }: {
    includeDetailedPerSourceMetadata?: boolean;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourcesMetadataKeyFn({
      includeDetailedPerSourceMetadata,
      userId,
    }),
    queryFn: () =>
      SourcesService.getSourcesMetadata({
        includeDetailedPerSourceMetadata,
        userId,
      }),
  });
/**
 * List Sources
 * List all data sources created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceListSources = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn({ userId }),
    queryFn: () => SourcesService.listSources({ userId }),
  });
/**
 * Get Agents For Source
 * Get all agent IDs that have the specified source attached.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
 * @returns string Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceGetAgentsForSource = (
  queryClient: QueryClient,
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetAgentsForSourceKeyFn({
      sourceId,
      userId,
    }),
    queryFn: () => SourcesService.getAgentsForSource({ sourceId, userId }),
  });
/**
 * List Source Passages
 * List all passages associated with a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.after Message after which to retrieve the returned messages.
 * @param data.before Message before which to retrieve the returned messages.
 * @param data.limit Maximum number of messages to retrieve.
 * @param data.userId
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
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn({
      after,
      before,
      limit,
      sourceId,
      userId,
    }),
    queryFn: () =>
      SourcesService.listSourcePassages({
        after,
        before,
        limit,
        sourceId,
        userId,
      }),
  });
/**
 * List Source Files
 * List paginated files associated with a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.limit Number of files to return
 * @param data.after Pagination cursor to fetch the next set of results
 * @param data.includeContent Whether to include full file content
 * @param data.checkStatusUpdates Whether to check and update file processing status (from the vector db service). If False, will not fetch and update the status, which may lead to performance gains.
 * @param data.userId
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
    userId,
  }: {
    after?: string;
    checkStatusUpdates?: boolean;
    includeContent?: boolean;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourceFilesKeyFn({
      after,
      checkStatusUpdates,
      includeContent,
      limit,
      sourceId,
      userId,
    }),
    queryFn: () =>
      SourcesService.listSourceFiles({
        after,
        checkStatusUpdates,
        includeContent,
        limit,
        sourceId,
        userId,
      }),
  });
/**
 * Get File Metadata
 * Retrieve metadata for a specific file by its ID.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.fileId
 * @param data.includeContent Whether to include full file content
 * @param data.userId
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceGetFileMetadata = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetFileMetadataKeyFn({
      fileId,
      includeContent,
      sourceId,
      userId,
    }),
    queryFn: () =>
      SourcesService.getFileMetadata({
        fileId,
        includeContent,
        sourceId,
        userId,
      }),
  });
/**
 * Count Folders
 * Count all data folders created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const prefetchUseFoldersServiceCountFolders = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceCountFoldersKeyFn({ userId }),
    queryFn: () => FoldersService.countFolders({ userId }),
  });
/**
 * Retrieve Folder
 * Get a folder by ID
 * @param data The data for the request.
 * @param data.folderId
 * @param data.userId
 * @returns Folder Successful Response
 * @throws ApiError
 */
export const prefetchUseFoldersServiceRetrieveFolder = (
  queryClient: QueryClient,
  {
    folderId,
    userId,
  }: {
    folderId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceRetrieveFolderKeyFn({ folderId, userId }),
    queryFn: () => FoldersService.retrieveFolder({ folderId, userId }),
  });
/**
 * Get Folder Id By Name
 * Get a folder by name
 * @param data The data for the request.
 * @param data.folderName
 * @param data.userId
 * @returns string Successful Response
 * @throws ApiError
 */
export const prefetchUseFoldersServiceGetFolderIdByName = (
  queryClient: QueryClient,
  {
    folderName,
    userId,
  }: {
    folderName: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceGetFolderIdByNameKeyFn({
      folderName,
      userId,
    }),
    queryFn: () => FoldersService.getFolderIdByName({ folderName, userId }),
  });
/**
 * Get Folders Metadata
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
 * @returns OrganizationSourcesStats Successful Response
 * @throws ApiError
 */
export const prefetchUseFoldersServiceGetFoldersMetadata = (
  queryClient: QueryClient,
  {
    includeDetailedPerSourceMetadata,
    userId,
  }: {
    includeDetailedPerSourceMetadata?: boolean;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceGetFoldersMetadataKeyFn({
      includeDetailedPerSourceMetadata,
      userId,
    }),
    queryFn: () =>
      FoldersService.getFoldersMetadata({
        includeDetailedPerSourceMetadata,
        userId,
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
 * @param data.userId
 * @returns Folder Successful Response
 * @throws ApiError
 */
export const prefetchUseFoldersServiceListFolders = (
  queryClient: QueryClient,
  {
    after,
    before,
    limit,
    order,
    orderBy,
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceListFoldersKeyFn({
      after,
      before,
      limit,
      order,
      orderBy,
      userId,
    }),
    queryFn: () =>
      FoldersService.listFolders({
        after,
        before,
        limit,
        order,
        orderBy,
        userId,
      }),
  });
/**
 * Get Agents For Folder
 * Get all agent IDs that have the specified folder attached.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.userId
 * @returns string Successful Response
 * @throws ApiError
 */
export const prefetchUseFoldersServiceGetAgentsForFolder = (
  queryClient: QueryClient,
  {
    folderId,
    userId,
  }: {
    folderId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceGetAgentsForFolderKeyFn({
      folderId,
      userId,
    }),
    queryFn: () => FoldersService.getAgentsForFolder({ folderId, userId }),
  });
/**
 * List Folder Passages
 * List all passages associated with a data folder.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.after Message after which to retrieve the returned messages.
 * @param data.before Message before which to retrieve the returned messages.
 * @param data.limit Maximum number of messages to retrieve.
 * @param data.userId
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
    userId,
  }: {
    after?: string;
    before?: string;
    folderId: string;
    limit?: number;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceListFolderPassagesKeyFn({
      after,
      before,
      folderId,
      limit,
      userId,
    }),
    queryFn: () =>
      FoldersService.listFolderPassages({
        after,
        before,
        folderId,
        limit,
        userId,
      }),
  });
/**
 * List Folder Files
 * List paginated files associated with a data folder.
 * @param data The data for the request.
 * @param data.folderId
 * @param data.limit Number of files to return
 * @param data.after Pagination cursor to fetch the next set of results
 * @param data.includeContent Whether to include full file content
 * @param data.userId
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const prefetchUseFoldersServiceListFolderFiles = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseFoldersServiceListFolderFilesKeyFn({
      after,
      folderId,
      includeContent,
      limit,
      userId,
    }),
    queryFn: () =>
      FoldersService.listFolderFiles({
        after,
        folderId,
        includeContent,
        limit,
        userId,
      }),
  });
/**
 * List Agents
 * List all agents associated with a given user.
 *
 * This endpoint retrieves a list of all agents and their configurations
 * associated with the specified user ID.
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
    order?: 'asc' | 'desc';
    orderBy?: 'created_at' | 'last_run_completion';
    projectId?: string;
    queryText?: string;
    sortBy?: string;
    tags?: string[];
    templateId?: string;
    userId?: string;
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
      userId,
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
        userId,
      }),
  });
/**
 * Count Agents
 * Get the count of all agents associated with a given user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceCountAgents = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceCountAgentsKeyFn({ userId }),
    queryFn: () => AgentsService.countAgents({ userId }),
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
    userId,
  }: {
    agentId: string;
    maxSteps?: number;
    requestBody?: Body_export_agent;
    useLegacyFormat?: boolean;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceExportAgentKeyFn({
      agentId,
      maxSteps,
      requestBody,
      useLegacyFormat,
      userId,
    }),
    queryFn: () =>
      AgentsService.exportAgent({
        agentId,
        maxSteps,
        requestBody,
        useLegacyFormat,
        userId,
      }),
  });
/**
 * Retrieve Agent Context Window
 * Retrieve the context window of a specific agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns ContextWindowOverview Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceRetrieveAgentContextWindow = (
  queryClient: QueryClient,
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceRetrieveAgentContextWindowKeyFn({
      agentId,
      userId,
    }),
    queryFn: () =>
      AgentsService.retrieveAgentContextWindow({ agentId, userId }),
  });
/**
 * Retrieve Agent
 * Get the state of the agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.includeRelationships Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. If not provided, all relationships are loaded by default. Using this can optimize performance by reducing unnecessary joins.
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceRetrieveAgent = (
  queryClient: QueryClient,
  {
    agentId,
    includeRelationships,
    userId,
  }: {
    agentId: string;
    includeRelationships?: string[];
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceRetrieveAgentKeyFn({
      agentId,
      includeRelationships,
      userId,
    }),
    queryFn: () =>
      AgentsService.retrieveAgent({ agentId, includeRelationships, userId }),
  });
/**
 * List Agent Tools
 * Get tools from an existing agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Tool Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListAgentTools = (
  queryClient: QueryClient,
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentToolsKeyFn({ agentId, userId }),
    queryFn: () => AgentsService.listAgentTools({ agentId, userId }),
  });
/**
 * List Agent Sources
 * Get the sources associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListAgentSources = (
  queryClient: QueryClient,
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentSourcesKeyFn({ agentId, userId }),
    queryFn: () => AgentsService.listAgentSources({ agentId, userId }),
  });
/**
 * List Agent Folders
 * Get the folders associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListAgentFolders = (
  queryClient: QueryClient,
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentFoldersKeyFn({ agentId, userId }),
    queryFn: () => AgentsService.listAgentFolders({ agentId, userId }),
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
    userId,
  }: {
    agentId: string;
    cursor?: string;
    isOpen?: boolean;
    limit?: number;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentFilesKeyFn({
      agentId,
      cursor,
      isOpen,
      limit,
      userId,
    }),
    queryFn: () =>
      AgentsService.listAgentFiles({ agentId, cursor, isOpen, limit, userId }),
  });
/**
 * Retrieve Agent Memory
 * Retrieve the memory state of a specific agent.
 * This endpoint fetches the current memory state of the agent identified by the user ID and agent ID.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Memory Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceRetrieveAgentMemory = (
  queryClient: QueryClient,
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceRetrieveAgentMemoryKeyFn({
      agentId,
      userId,
    }),
    queryFn: () => AgentsService.retrieveAgentMemory({ agentId, userId }),
  });
/**
 * Retrieve Block
 * Retrieve a core memory block from an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockLabel
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceRetrieveCoreMemoryBlock = (
  queryClient: QueryClient,
  {
    agentId,
    blockLabel,
    userId,
  }: {
    agentId: string;
    blockLabel: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceRetrieveCoreMemoryBlockKeyFn({
      agentId,
      blockLabel,
      userId,
    }),
    queryFn: () =>
      AgentsService.retrieveCoreMemoryBlock({ agentId, blockLabel, userId }),
  });
/**
 * List Blocks
 * Retrieve the core memory blocks of a specific agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListCoreMemoryBlocks = (
  queryClient: QueryClient,
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListCoreMemoryBlocksKeyFn({
      agentId,
      userId,
    }),
    queryFn: () => AgentsService.listCoreMemoryBlocks({ agentId, userId }),
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListPassagesKeyFn({
      after,
      agentId,
      ascending,
      before,
      limit,
      search,
      userId,
    }),
    queryFn: () =>
      AgentsService.listPassages({
        after,
        agentId,
        ascending,
        before,
        limit,
        search,
        userId,
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
    userId,
  }: {
    agentId: string;
    endDatetime?: string;
    query: string;
    startDatetime?: string;
    tagMatchMode?: 'any' | 'all';
    tags?: string[];
    topK?: number;
    userId?: string;
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
      userId,
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
        userId,
      }),
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
      useAssistantMessage,
      userId,
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
        useAssistantMessage,
        userId,
      }),
  });
/**
 * List Agent Groups
 * Lists the groups for an agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.managerType Manager type to filter groups by
 * @param data.userId
 * @returns Group Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceListAgentGroups = (
  queryClient: QueryClient,
  {
    agentId,
    managerType,
    userId,
  }: {
    agentId: string;
    managerType?: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentGroupsKeyFn({
      agentId,
      managerType,
      userId,
    }),
    queryFn: () =>
      AgentsService.listAgentGroups({ agentId, managerType, userId }),
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
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    managerType?: ManagerType;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    projectId?: string;
    userId?: string;
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
      userId,
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
        userId,
      }),
  });
/**
 * Count Groups
 * Get the count of all groups associated with a given user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const prefetchUseGroupsServiceCountGroups = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGroupsServiceCountGroupsKeyFn({ userId }),
    queryFn: () => GroupsService.countGroups({ userId }),
  });
/**
 * Retrieve Group
 * Retrieve the group by id.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.userId
 * @returns Group Successful Response
 * @throws ApiError
 */
export const prefetchUseGroupsServiceRetrieveGroup = (
  queryClient: QueryClient,
  {
    groupId,
    userId,
  }: {
    groupId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGroupsServiceRetrieveGroupKeyFn({ groupId, userId }),
    queryFn: () => GroupsService.retrieveGroup({ groupId, userId }),
  });
/**
 * List Group Messages
 * Retrieve message history for an agent.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.after Message after which to retrieve the returned messages.
 * @param data.before Message before which to retrieve the returned messages.
 * @param data.limit Maximum number of messages to retrieve.
 * @param data.useAssistantMessage Whether to use assistant messages
 * @param data.assistantMessageToolName The name of the designated message tool.
 * @param data.assistantMessageToolKwarg The name of the message argument.
 * @param data.userId
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseGroupsServiceListGroupMessagesKeyFn({
      after,
      assistantMessageToolKwarg,
      assistantMessageToolName,
      before,
      groupId,
      limit,
      useAssistantMessage,
      userId,
    }),
    queryFn: () =>
      GroupsService.listGroupMessages({
        after,
        assistantMessageToolKwarg,
        assistantMessageToolName,
        before,
        groupId,
        limit,
        useAssistantMessage,
        userId,
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
    userId,
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
    userId?: string;
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
      userId,
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
        userId,
      }),
  });
/**
 * Count Identities
 * Get count of all identities for a user
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const prefetchUseIdentitiesServiceCountIdentities = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseIdentitiesServiceCountIdentitiesKeyFn({ userId }),
    queryFn: () => IdentitiesService.countIdentities({ userId }),
  });
/**
 * Retrieve Identity
 * @param data The data for the request.
 * @param data.identityId
 * @param data.userId
 * @returns Identity Successful Response
 * @throws ApiError
 */
export const prefetchUseIdentitiesServiceRetrieveIdentity = (
  queryClient: QueryClient,
  {
    identityId,
    userId,
  }: {
    identityId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseIdentitiesServiceRetrieveIdentityKeyFn({
      identityId,
      userId,
    }),
    queryFn: () => IdentitiesService.retrieveIdentity({ identityId, userId }),
  });
/**
 * List Deployment Entities
 * List all entities (blocks, agents, groups) with the specified deployment_id.
 * Optionally filter by entity types.
 * @param data The data for the request.
 * @param data.deploymentId
 * @param data.entityTypes Filter by entity types (block, agent, group)
 * @param data.userId
 * @returns ListDeploymentEntitiesResponse Successful Response
 * @throws ApiError
 */
export const prefetchUseInternalTemplatesServiceListDeploymentEntities = (
  queryClient: QueryClient,
  {
    deploymentId,
    entityTypes,
    userId,
  }: {
    deploymentId: string;
    entityTypes?: string[];
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseInternalTemplatesServiceListDeploymentEntitiesKeyFn({
      deploymentId,
      entityTypes,
      userId,
    }),
    queryFn: () =>
      InternalTemplatesService.listDeploymentEntities({
        deploymentId,
        entityTypes,
        userId,
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
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const prefetchUseModelsServiceListModels = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListModelsKeyFn({
      providerCategory,
      providerName,
      providerType,
      userId,
    }),
    queryFn: () =>
      ModelsService.listModels({
        providerCategory,
        providerName,
        providerType,
        userId,
      }),
  });
/**
 * List Embedding Models
 * List available embedding models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.userId
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const prefetchUseModelsServiceListEmbeddingModels = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn({ userId }),
    queryFn: () => ModelsService.listEmbeddingModels({ userId }),
  });
/**
 * List Llm Models
 * List available LLM models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.providerCategory
 * @param data.providerName
 * @param data.providerType
 * @param data.userId
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const prefetchUseLlmsServiceListModels = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseLlmsServiceListModelsKeyFn({
      providerCategory,
      providerName,
      providerType,
      userId,
    }),
    queryFn: () =>
      LlmsService.listModels({
        providerCategory,
        providerName,
        providerType,
        userId,
      }),
  });
/**
 * List Embedding Models
 * List available embedding models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.userId
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const prefetchUseLlmsServiceListEmbeddingModels = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn({ userId }),
    queryFn: () => LlmsService.listEmbeddingModels({ userId }),
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
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    projectId?: string;
    templatesOnly?: boolean;
    userId?: string;
    valueSearch?: string;
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
      userId,
      valueSearch,
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
        userId,
        valueSearch,
      }),
  });
/**
 * Count Blocks
 * Count all blocks created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const prefetchUseBlocksServiceCountBlocks = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceCountBlocksKeyFn({ userId }),
    queryFn: () => BlocksService.countBlocks({ userId }),
  });
/**
 * Retrieve Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const prefetchUseBlocksServiceRetrieveBlock = (
  queryClient: QueryClient,
  {
    blockId,
    userId,
  }: {
    blockId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceRetrieveBlockKeyFn({ blockId, userId }),
    queryFn: () => BlocksService.retrieveBlock({ blockId, userId }),
  });
/**
 * List Agents For Block
 * Retrieves all agents associated with the specified block.
 * Raises a 404 if the block does not exist.
 * @param data The data for the request.
 * @param data.blockId
 * @param data.includeRelationships Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. If not provided, all relationships are loaded by default. Using this can optimize performance by reducing unnecessary joins.
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const prefetchUseBlocksServiceListAgentsForBlock = (
  queryClient: QueryClient,
  {
    blockId,
    includeRelationships,
    userId,
  }: {
    blockId: string;
    includeRelationships?: string[];
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceListAgentsForBlockKeyFn({
      blockId,
      includeRelationships,
      userId,
    }),
    queryFn: () =>
      BlocksService.listAgentsForBlock({
        blockId,
        includeRelationships,
        userId,
      }),
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
 * @returns Job Successful Response
 * @throws ApiError
 */
export const prefetchUseJobsServiceListJobs = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListJobsKeyFn({
      after,
      ascending,
      before,
      limit,
      sourceId,
      userId,
    }),
    queryFn: () =>
      JobsService.listJobs({
        after,
        ascending,
        before,
        limit,
        sourceId,
        userId,
      }),
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
    userId,
  }: {
    after?: string;
    ascending?: boolean;
    before?: string;
    limit?: number;
    sourceId?: string;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn({
      after,
      ascending,
      before,
      limit,
      sourceId,
      userId,
    }),
    queryFn: () =>
      JobsService.listActiveJobs({
        after,
        ascending,
        before,
        limit,
        sourceId,
        userId,
      }),
  });
/**
 * Retrieve Job
 * Get the status of a job.
 * @param data The data for the request.
 * @param data.jobId
 * @param data.userId
 * @returns Job Successful Response
 * @throws ApiError
 */
export const prefetchUseJobsServiceRetrieveJob = (
  queryClient: QueryClient,
  {
    jobId,
    userId,
  }: {
    jobId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceRetrieveJobKeyFn({ jobId, userId }),
    queryFn: () => JobsService.retrieveJob({ jobId, userId }),
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
      userId,
    }: {
      after?: string;
      limit?: number;
      sandboxType?: SandboxType;
      userId?: string;
    } = {},
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKeyFn(
          { after, limit, sandboxType, userId },
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxConfigsV1SandboxConfigGet({
          after,
          limit,
          sandboxType,
          userId,
        }),
    });
/**
 * List Sandbox Env Vars
 * @param data The data for the request.
 * @param data.sandboxConfigId
 * @param data.limit Number of results to return
 * @param data.after Pagination cursor to fetch the next set of results
 * @param data.userId
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
      userId,
    }: {
      after?: string;
      limit?: number;
      sandboxConfigId: string;
      userId?: string;
    },
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKeyFn(
          { after, limit, sandboxConfigId, userId },
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
          { after, limit, sandboxConfigId, userId },
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
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    name?: string;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    providerType?: ProviderType;
    userId?: string;
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
      userId,
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
        userId,
      }),
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
 * @returns Run Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceListRuns = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListRunsKeyFn({
      after,
      agentIds,
      ascending,
      background,
      before,
      limit,
      userId,
    }),
    queryFn: () =>
      RunsService.listRuns({
        after,
        agentIds,
        ascending,
        background,
        before,
        limit,
        userId,
      }),
  });
/**
 * List Active Runs
 * List all active runs.
 * @param data The data for the request.
 * @param data.agentIds The unique identifier of the agent associated with the run.
 * @param data.background If True, filters for runs that were created in background mode.
 * @param data.userId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceListActiveRuns = (
  queryClient: QueryClient,
  {
    agentIds,
    background,
    userId,
  }: {
    agentIds?: string[];
    background?: boolean;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListActiveRunsKeyFn({
      agentIds,
      background,
      userId,
    }),
    queryFn: () => RunsService.listActiveRuns({ agentIds, background, userId }),
  });
/**
 * Retrieve Run
 * Get the status of a run.
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceRetrieveRun = (
  queryClient: QueryClient,
  {
    runId,
    userId,
  }: {
    runId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceRetrieveRunKeyFn({ runId, userId }),
    queryFn: () => RunsService.retrieveRun({ runId, userId }),
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
    runId,
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    runId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListRunMessagesKeyFn({
      after,
      before,
      limit,
      order,
      runId,
      userId,
    }),
    queryFn: () =>
      RunsService.listRunMessages({
        after,
        before,
        limit,
        order,
        runId,
        userId,
      }),
  });
/**
 * Retrieve Run Usage
 * Get usage statistics for a run.
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
 * @returns UsageStatistics Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceRetrieveRunUsage = (
  queryClient: QueryClient,
  {
    runId,
    userId,
  }: {
    runId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceRetrieveRunUsageKeyFn({ runId, userId }),
    queryFn: () => RunsService.retrieveRunUsage({ runId, userId }),
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListRunStepsKeyFn({
      after,
      before,
      limit,
      order,
      runId,
      userId,
    }),
    queryFn: () =>
      RunsService.listRunSteps({ after, before, limit, order, runId, userId }),
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
 * @param data.userId
 * @param data.xProject Filter by project slug to associate with the group (cloud only).
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
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    projectId?: string;
    startDate?: string;
    tags?: string[];
    traceIds?: string[];
    userId?: string;
    xProject?: string;
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
      userId,
      xProject,
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
        userId,
        xProject,
      }),
  });
/**
 * Retrieve Step
 * Get a step by ID.
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @returns Step Successful Response
 * @throws ApiError
 */
export const prefetchUseStepsServiceRetrieveStep = (
  queryClient: QueryClient,
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseStepsServiceRetrieveStepKeyFn({ stepId, userId }),
    queryFn: () => StepsService.retrieveStep({ stepId, userId }),
  });
/**
 * Retrieve Step Metrics
 * Get step metrics by step ID.
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @returns StepMetrics Successful Response
 * @throws ApiError
 */
export const prefetchUseStepsServiceRetrieveStepMetrics = (
  queryClient: QueryClient,
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseStepsServiceRetrieveStepMetricsKeyFn({
      stepId,
      userId,
    }),
    queryFn: () => StepsService.retrieveStepMetrics({ stepId, userId }),
  });
/**
 * Retrieve Step Trace
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const prefetchUseStepsServiceRetrieveStepTrace = (
  queryClient: QueryClient,
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseStepsServiceRetrieveStepTraceKeyFn({ stepId, userId }),
    queryFn: () => StepsService.retrieveStepTrace({ stepId, userId }),
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
 * @param data.queryText Filter tags by text search
 * @param data.userId
 * @returns string Successful Response
 * @throws ApiError
 */
export const prefetchUseTagServiceListTags = (
  queryClient: QueryClient,
  {
    after,
    before,
    limit,
    order,
    orderBy,
    queryText,
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'name';
    queryText?: string;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseTagServiceListTagsKeyFn({
      after,
      before,
      limit,
      order,
      orderBy,
      queryText,
      userId,
    }),
    queryFn: () =>
      TagService.listTags({
        after,
        before,
        limit,
        order,
        orderBy,
        queryText,
        userId,
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
 * @param data.queryText Filter tags by text search
 * @param data.userId
 * @returns string Successful Response
 * @throws ApiError
 */
export const prefetchUseAdminServiceListTags = (
  queryClient: QueryClient,
  {
    after,
    before,
    limit,
    order,
    orderBy,
    queryText,
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'name';
    queryText?: string;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListTagsKeyFn({
      after,
      before,
      limit,
      order,
      orderBy,
      queryText,
      userId,
    }),
    queryFn: () =>
      AdminService.listTags({
        after,
        before,
        limit,
        order,
        orderBy,
        queryText,
        userId,
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
 * Retrieve Provider Trace By Step Id
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const prefetchUseTelemetryServiceRetrieveProviderTrace = (
  queryClient: QueryClient,
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseTelemetryServiceRetrieveProviderTraceKeyFn({
      stepId,
      userId,
    }),
    queryFn: () => TelemetryService.retrieveProviderTrace({ stepId, userId }),
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
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseMessagesServiceListBatchesKeyFn({
      after,
      before,
      limit,
      order,
      orderBy,
      userId,
    }),
    queryFn: () =>
      MessagesService.listBatches({
        after,
        before,
        limit,
        order,
        orderBy,
        userId,
      }),
  });
/**
 * Retrieve Batch
 * Retrieve the status and details of a batch run.
 * @param data The data for the request.
 * @param data.batchId
 * @param data.userId
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const prefetchUseMessagesServiceRetrieveBatch = (
  queryClient: QueryClient,
  {
    batchId,
    userId,
  }: {
    batchId: string;
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseMessagesServiceRetrieveBatchKeyFn({ batchId, userId }),
    queryFn: () => MessagesService.retrieveBatch({ batchId, userId }),
  });
/**
 * List Batch Messages
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
 * @returns LettaBatchMessages Successful Response
 * @throws ApiError
 */
export const prefetchUseMessagesServiceListBatchMessages = (
  queryClient: QueryClient,
  {
    after,
    agentId,
    batchId,
    before,
    limit,
    order,
    orderBy,
    userId,
  }: {
    after?: string;
    agentId?: string;
    batchId: string;
    before?: string;
    limit?: number;
    order?: 'asc' | 'desc';
    orderBy?: 'created_at';
    userId?: string;
  },
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseMessagesServiceListBatchMessagesKeyFn({
      after,
      agentId,
      batchId,
      before,
      limit,
      order,
      orderBy,
      userId,
    }),
    queryFn: () =>
      MessagesService.listBatchMessages({
        after,
        agentId,
        batchId,
        before,
        limit,
        order,
        orderBy,
        userId,
      }),
  });
/**
 * Get Embeddings Total Storage Size
 * Get the total size of all embeddings in the database for a user in the storage unit given.
 * @param data The data for the request.
 * @param data.userId
 * @param data.storageUnit
 * @returns number Successful Response
 * @throws ApiError
 */
export const prefetchUseEmbeddingsServiceGetTotalStorageSize = (
  queryClient: QueryClient,
  {
    storageUnit,
    userId,
  }: {
    storageUnit?: string;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseEmbeddingsServiceGetTotalStorageSizeKeyFn({
      storageUnit,
      userId,
    }),
    queryFn: () =>
      EmbeddingsService.getTotalStorageSize({ storageUnit, userId }),
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

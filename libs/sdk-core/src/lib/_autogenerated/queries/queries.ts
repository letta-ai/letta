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
  AgentSchema,
  AuthRequest,
  BlockUpdate,
  Body_import_agent_serialized,
  Body_upload_file_to_source,
  CreateAgentRequest,
  CreateArchivalMemory,
  CreateBatch,
  CreateBlock,
  GroupCreate,
  GroupUpdate,
  IdentityCreate,
  IdentityProperty,
  IdentityType,
  IdentityUpdate,
  IdentityUpsert,
  LettaRequest,
  LettaStreamingRequest,
  LocalSandboxConfig,
  ManagerType,
  MessageRole,
  OrganizationCreate,
  OrganizationUpdate,
  PassageUpdate,
  ProviderCategory,
  ProviderCreate,
  ProviderType,
  ProviderUpdate,
  SSEServerConfig,
  SandboxConfigCreate,
  SandboxConfigUpdate,
  SandboxEnvironmentVariableCreate,
  SandboxEnvironmentVariableUpdate,
  SandboxType,
  SourceCreate,
  SourceUpdate,
  StdioServerConfig,
  ToolCreate,
  ToolRunFromSource,
  ToolUpdate,
  UpdateAgent,
  UpdateAssistantMessage,
  UpdateReasoningMessage,
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
    userId,
  }: {
    toolId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceRetrieveToolKeyFn(
      { toolId, userId },
      queryKey,
    ),
    queryFn: () => ToolsService.retrieveTool({ toolId, userId }) as TData,
    ...options,
  });
/**
 * Count Tools
 * Get a count of all tools available to agents belonging to the org of the user.
 * @param data The data for the request.
 * @param data.includeBaseTools Include built-in Letta tools in the count
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const useToolsServiceCountTools = <
  TData = Common.ToolsServiceCountToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    includeBaseTools,
    userId,
  }: {
    includeBaseTools?: boolean;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceCountToolsKeyFn(
      { includeBaseTools, userId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.countTools({ includeBaseTools, userId }) as TData,
    ...options,
  });
/**
 * List Tools
 * Get a list of all tools available to agents belonging to the org of the user
 * @param data The data for the request.
 * @param data.after
 * @param data.limit
 * @param data.name
 * @param data.userId
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
    limit,
    name,
    userId,
  }: {
    after?: string;
    limit?: number;
    name?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListToolsKeyFn(
      { after, limit, name, userId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listTools({ after, limit, name, userId }) as TData,
    ...options,
  });
/**
 * List Composio Apps
 * Get a list of all Composio apps
 * @param data The data for the request.
 * @param data.userId
 * @returns AppModel Successful Response
 * @throws ApiError
 */
export const useToolsServiceListComposioApps = <
  TData = Common.ToolsServiceListComposioAppsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioAppsKeyFn({ userId }, queryKey),
    queryFn: () => ToolsService.listComposioApps({ userId }) as TData,
    ...options,
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
export const useToolsServiceListComposioActionsByApp = <
  TData = Common.ToolsServiceListComposioActionsByAppDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    composioAppName,
    userId,
  }: {
    composioAppName: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioActionsByAppKeyFn(
      { composioAppName, userId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listComposioActionsByApp({
        composioAppName,
        userId,
      }) as TData,
    ...options,
  });
/**
 * List Mcp Servers
 * Get a list of all configured MCP servers
 * @param data The data for the request.
 * @param data.userId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useToolsServiceListMcpServers = <
  TData = Common.ToolsServiceListMcpServersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListMcpServersKeyFn({ userId }, queryKey),
    queryFn: () => ToolsService.listMcpServers({ userId }) as TData,
    ...options,
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
export const useToolsServiceListMcpToolsByServer = <
  TData = Common.ToolsServiceListMcpToolsByServerDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    mcpServerName,
    userId,
  }: {
    mcpServerName: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListMcpToolsByServerKeyFn(
      { mcpServerName, userId },
      queryKey,
    ),
    queryFn: () =>
      ToolsService.listMcpToolsByServer({ mcpServerName, userId }) as TData,
    ...options,
  });
/**
 * Count Sources
 * Count all data sources created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const useSourcesServiceCountSources = <
  TData = Common.SourcesServiceCountSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceCountSourcesKeyFn({ userId }, queryKey),
    queryFn: () => SourcesService.countSources({ userId }) as TData,
    ...options,
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
export const useSourcesServiceRetrieveSource = <
  TData = Common.SourcesServiceRetrieveSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceRetrieveSourceKeyFn(
      { sourceId, userId },
      queryKey,
    ),
    queryFn: () => SourcesService.retrieveSource({ sourceId, userId }) as TData,
    ...options,
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
export const useSourcesServiceGetSourceIdByName = <
  TData = Common.SourcesServiceGetSourceIdByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    sourceName,
    userId,
  }: {
    sourceName: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn(
      { sourceName, userId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.getSourceIdByName({ sourceName, userId }) as TData,
    ...options,
  });
/**
 * List Sources
 * List all data sources created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceListSources = <
  TData = Common.SourcesServiceListSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn({ userId }, queryKey),
    queryFn: () => SourcesService.listSources({ userId }) as TData,
    ...options,
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
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn(
      { after, before, limit, sourceId, userId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listSourcePassages({
        after,
        before,
        limit,
        sourceId,
        userId,
      }) as TData,
    ...options,
  });
/**
 * List Source Files
 * List paginated files associated with a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.limit Number of files to return
 * @param data.after Pagination cursor to fetch the next set of results
 * @param data.includeContent Whether to include full file content
 * @param data.userId
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
    includeContent,
    limit,
    sourceId,
    userId,
  }: {
    after?: string;
    includeContent?: boolean;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourceFilesKeyFn(
      { after, includeContent, limit, sourceId, userId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listSourceFiles({
        after,
        includeContent,
        limit,
        sourceId,
        userId,
      }) as TData,
    ...options,
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
 * @param data.projectId Search agents by project ID
 * @param data.templateId Search agents by template ID
 * @param data.baseTemplateId Search agents by base template ID
 * @param data.identityId Search agents by identity ID
 * @param data.identifierKeys Search agents by identifier keys
 * @param data.includeRelationships Specify which relational fields (e.g., 'tools', 'sources', 'memory') to include in the response. If not provided, all relationships are loaded by default. Using this can optimize performance by reducing unnecessary joins.
 * @param data.ascending Whether to sort agents oldest to newest (True) or newest to oldest (False, default)
 * @param data.userId
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
        projectId,
        queryText,
        tags,
        templateId,
        userId,
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
        projectId,
        queryText,
        tags,
        templateId,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Count Agents
 * Get the count of all agents associated with a given user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCountAgents = <
  TData = Common.AgentsServiceCountAgentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceCountAgentsKeyFn({ userId }, queryKey),
    queryFn: () => AgentsService.countAgents({ userId }) as TData,
    ...options,
  });
/**
 * Export Agent Serialized
 * Export the serialized JSON representation of an agent, formatted with indentation.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @param data.requestBody
 * @returns string Successful Response
 * @throws ApiError
 */
export const useAgentsServiceExportAgentSerialized = <
  TData = Common.AgentsServiceExportAgentSerializedDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    requestBody,
    userId,
  }: {
    agentId: string;
    requestBody?: AgentSchema;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceExportAgentSerializedKeyFn(
      { agentId, requestBody, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.exportAgentSerialized({
        agentId,
        requestBody,
        userId,
      }) as TData,
    ...options,
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
export const useAgentsServiceRetrieveAgentContextWindow = <
  TData = Common.AgentsServiceRetrieveAgentContextWindowDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentContextWindowKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgentContextWindow({ agentId, userId }) as TData,
    ...options,
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
export const useAgentsServiceRetrieveAgent = <
  TData = Common.AgentsServiceRetrieveAgentDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    includeRelationships,
    userId,
  }: {
    agentId: string;
    includeRelationships?: string[];
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentKeyFn(
      { agentId, includeRelationships, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgent({
        agentId,
        includeRelationships,
        userId,
      }) as TData,
    ...options,
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
export const useAgentsServiceListAgentTools = <
  TData = Common.AgentsServiceListAgentToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentToolsKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () => AgentsService.listAgentTools({ agentId, userId }) as TData,
    ...options,
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
export const useAgentsServiceListAgentSources = <
  TData = Common.AgentsServiceListAgentSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentSourcesKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () => AgentsService.listAgentSources({ agentId, userId }) as TData,
    ...options,
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
export const useAgentsServiceRetrieveAgentMemory = <
  TData = Common.AgentsServiceRetrieveAgentMemoryDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentMemoryKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveAgentMemory({ agentId, userId }) as TData,
    ...options,
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
export const useAgentsServiceRetrieveCoreMemoryBlock = <
  TData = Common.AgentsServiceRetrieveCoreMemoryBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    blockLabel,
    userId,
  }: {
    agentId: string;
    blockLabel: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveCoreMemoryBlockKeyFn(
      { agentId, blockLabel, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.retrieveCoreMemoryBlock({
        agentId,
        blockLabel,
        userId,
      }) as TData,
    ...options,
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
export const useAgentsServiceListCoreMemoryBlocks = <
  TData = Common.AgentsServiceListCoreMemoryBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListCoreMemoryBlocksKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listCoreMemoryBlocks({ agentId, userId }) as TData,
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListPassagesKeyFn(
      { after, agentId, ascending, before, limit, search, userId },
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
        userId,
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
 * @param data.userId
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
        limit,
        useAssistantMessage,
        userId,
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
        limit,
        useAssistantMessage,
        userId,
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
    userId,
  }: {
    agentId: string;
    managerType?: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentGroupsKeyFn(
      { agentId, managerType, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentGroups({ agentId, managerType, userId }) as TData,
    ...options,
  });
/**
 * List Groups
 * Fetch all multi-agent groups matching query.
 * @param data The data for the request.
 * @param data.managerType Search groups by manager type
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Limit for pagination
 * @param data.projectId Search groups by project id
 * @param data.userId
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceListGroupsKeyFn(
      { after, before, limit, managerType, projectId, userId },
      queryKey,
    ),
    queryFn: () =>
      GroupsService.listGroups({
        after,
        before,
        limit,
        managerType,
        projectId,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Count Groups
 * Get the count of all groups associated with a given user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const useGroupsServiceCountGroups = <
  TData = Common.GroupsServiceCountGroupsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceCountGroupsKeyFn({ userId }, queryKey),
    queryFn: () => GroupsService.countGroups({ userId }) as TData,
    ...options,
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
export const useGroupsServiceRetrieveGroup = <
  TData = Common.GroupsServiceRetrieveGroupDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    groupId,
    userId,
  }: {
    groupId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseGroupsServiceRetrieveGroupKeyFn(
      { groupId, userId },
      queryKey,
    ),
    queryFn: () => GroupsService.retrieveGroup({ groupId, userId }) as TData,
    ...options,
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
        useAssistantMessage,
        userId,
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
        useAssistantMessage,
        userId,
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
 * @param data.before
 * @param data.after
 * @param data.limit
 * @param data.userId
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
        projectId,
        userId,
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
        projectId,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Count Identities
 * Get count of all identities for a user
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const useIdentitiesServiceCountIdentities = <
  TData = Common.IdentitiesServiceCountIdentitiesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceCountIdentitiesKeyFn(
      { userId },
      queryKey,
    ),
    queryFn: () => IdentitiesService.countIdentities({ userId }) as TData,
    ...options,
  });
/**
 * Retrieve Identity
 * @param data The data for the request.
 * @param data.identityId
 * @param data.userId
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
    userId,
  }: {
    identityId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseIdentitiesServiceRetrieveIdentityKeyFn(
      { identityId, userId },
      queryKey,
    ),
    queryFn: () =>
      IdentitiesService.retrieveIdentity({ identityId, userId }) as TData,
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
    userId,
  }: {
    providerCategory?: ProviderCategory[];
    providerName?: string;
    providerType?: ProviderType;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListModelsKeyFn(
      { providerCategory, providerName, providerType, userId },
      queryKey,
    ),
    queryFn: () =>
      ModelsService.listModels({
        providerCategory,
        providerName,
        providerType,
        userId,
      }) as TData,
    ...options,
  });
/**
 * List Embedding Models
 * List available embedding models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.userId
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const useModelsServiceListEmbeddingModels = <
  TData = Common.ModelsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn(
      { userId },
      queryKey,
    ),
    queryFn: () => ModelsService.listEmbeddingModels({ userId }) as TData,
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
    userId,
  }: {
    providerCategory?: ProviderCategory[];
    providerName?: string;
    providerType?: ProviderType;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListModelsKeyFn(
      { providerCategory, providerName, providerType, userId },
      queryKey,
    ),
    queryFn: () =>
      LlmsService.listModels({
        providerCategory,
        providerName,
        providerType,
        userId,
      }) as TData,
    ...options,
  });
/**
 * List Embedding Models
 * List available embedding models using the asynchronous implementation for improved performance
 * @param data The data for the request.
 * @param data.userId
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const useLlmsServiceListEmbeddingModels = <
  TData = Common.LlmsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn(
      { userId },
      queryKey,
    ),
    queryFn: () => LlmsService.listEmbeddingModels({ userId }) as TData,
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
 * @param data.limit Number of blocks to return
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceListBlocks = <
  TData = Common.BlocksServiceListBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    identifierKeys,
    identityId,
    label,
    limit,
    name,
    templatesOnly,
    userId,
  }: {
    identifierKeys?: string[];
    identityId?: string;
    label?: string;
    limit?: number;
    name?: string;
    templatesOnly?: boolean;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceListBlocksKeyFn(
      { identifierKeys, identityId, label, limit, name, templatesOnly, userId },
      queryKey,
    ),
    queryFn: () =>
      BlocksService.listBlocks({
        identifierKeys,
        identityId,
        label,
        limit,
        name,
        templatesOnly,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Count Blocks
 * Count all blocks created by a user.
 * @param data The data for the request.
 * @param data.userId
 * @returns number Successful Response
 * @throws ApiError
 */
export const useBlocksServiceCountBlocks = <
  TData = Common.BlocksServiceCountBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceCountBlocksKeyFn({ userId }, queryKey),
    queryFn: () => BlocksService.countBlocks({ userId }) as TData,
    ...options,
  });
/**
 * Retrieve Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
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
    userId,
  }: {
    blockId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceRetrieveBlockKeyFn(
      { blockId, userId },
      queryKey,
    ),
    queryFn: () => BlocksService.retrieveBlock({ blockId, userId }) as TData,
    ...options,
  });
/**
 * List Agents For Block
 * Retrieves all agents associated with the specified block.
 * Raises a 404 if the block does not exist.
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useBlocksServiceListAgentsForBlock = <
  TData = Common.BlocksServiceListAgentsForBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    blockId,
    userId,
  }: {
    blockId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceListAgentsForBlockKeyFn(
      { blockId, userId },
      queryKey,
    ),
    queryFn: () =>
      BlocksService.listAgentsForBlock({ blockId, userId }) as TData,
    ...options,
  });
/**
 * List Jobs
 * List all jobs.
 * @param data The data for the request.
 * @param data.sourceId Only list jobs associated with the source.
 * @param data.userId
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceListJobs = <
  TData = Common.JobsServiceListJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    sourceId,
    userId,
  }: {
    sourceId?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsKeyFn(
      { sourceId, userId },
      queryKey,
    ),
    queryFn: () => JobsService.listJobs({ sourceId, userId }) as TData,
    ...options,
  });
/**
 * List Active Jobs
 * List all active jobs.
 * @param data The data for the request.
 * @param data.sourceId Only list jobs associated with the source.
 * @param data.userId
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceListActiveJobs = <
  TData = Common.JobsServiceListActiveJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    sourceId,
    userId,
  }: {
    sourceId?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn(
      { sourceId, userId },
      queryKey,
    ),
    queryFn: () => JobsService.listActiveJobs({ sourceId, userId }) as TData,
    ...options,
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
export const useJobsServiceRetrieveJob = <
  TData = Common.JobsServiceRetrieveJobDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    jobId,
    userId,
  }: {
    jobId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceRetrieveJobKeyFn(
      { jobId, userId },
      queryKey,
    ),
    queryFn: () => JobsService.retrieveJob({ jobId, userId }) as TData,
    ...options,
  });
/**
 * Health Check
 * @returns Health Successful Response
 * @throws ApiError
 */
export const useHealthServiceHealthCheck = <
  TData = Common.HealthServiceHealthCheckDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseHealthServiceHealthCheckKeyFn(queryKey),
    queryFn: () => HealthService.healthCheck() as TData,
    ...options,
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
export const useSandboxConfigServiceListSandboxConfigsV1SandboxConfigGet = <
  TData = Common.SandboxConfigServiceListSandboxConfigsV1SandboxConfigGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey:
      Common.UseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKeyFn(
        { after, limit, sandboxType, userId },
        queryKey,
      ),
    queryFn: () =>
      SandboxConfigService.listSandboxConfigsV1SandboxConfigGet({
        after,
        limit,
        sandboxType,
        userId,
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
      userId,
    }: {
      after?: string;
      limit?: number;
      sandboxConfigId: string;
      userId?: string;
    },
    queryKey?: TQueryKey,
    options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
  ) =>
    useQuery<TData, TError>({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKeyFn(
          { after, limit, sandboxConfigId, userId },
          queryKey,
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
          { after, limit, sandboxConfigId, userId },
        ) as TData,
      ...options,
    });
/**
 * List Providers
 * Get a list of all custom providers in the database
 * @param data The data for the request.
 * @param data.name
 * @param data.providerType
 * @param data.after
 * @param data.limit
 * @param data.userId
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseProvidersServiceListProvidersKeyFn(
      { after, limit, name, providerType, userId },
      queryKey,
    ),
    queryFn: () =>
      ProvidersService.listProviders({
        after,
        limit,
        name,
        providerType,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Check Provider
 * @param data The data for the request.
 * @param data.providerType
 * @param data.xApiKey
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useProvidersServiceCheckProvider = <
  TData = Common.ProvidersServiceCheckProviderDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    providerType,
    xApiKey,
  }: {
    providerType: ProviderType;
    xApiKey: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseProvidersServiceCheckProviderKeyFn(
      { providerType, xApiKey },
      queryKey,
    ),
    queryFn: () =>
      ProvidersService.checkProvider({ providerType, xApiKey }) as TData,
    ...options,
  });
/**
 * List Runs
 * List all runs.
 * @param data The data for the request.
 * @param data.agentIds The unique identifier of the agent associated with the run.
 * @param data.userId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceListRuns = <
  TData = Common.RunsServiceListRunsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentIds,
    userId,
  }: {
    agentIds?: string[];
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunsKeyFn(
      { agentIds, userId },
      queryKey,
    ),
    queryFn: () => RunsService.listRuns({ agentIds, userId }) as TData,
    ...options,
  });
/**
 * List Active Runs
 * List all active runs.
 * @param data The data for the request.
 * @param data.agentIds The unique identifier of the agent associated with the run.
 * @param data.userId
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
    userId,
  }: {
    agentIds?: string[];
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListActiveRunsKeyFn(
      { agentIds, userId },
      queryKey,
    ),
    queryFn: () => RunsService.listActiveRuns({ agentIds, userId }) as TData,
    ...options,
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
export const useRunsServiceRetrieveRun = <
  TData = Common.RunsServiceRetrieveRunDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    runId,
    userId,
  }: {
    runId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceRetrieveRunKeyFn(
      { runId, userId },
      queryKey,
    ),
    queryFn: () => RunsService.retrieveRun({ runId, userId }) as TData,
    ...options,
  });
/**
 * List Run Messages
 * Get messages associated with a run with filtering options.
 *
 * Args:
 * run_id: ID of the run
 * before: A cursor for use in pagination. `before` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with obj_foo, your subsequent call can include before=obj_foo in order to fetch the previous page of the list.
 * after: A cursor for use in pagination. `after` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with obj_foo, your subsequent call can include after=obj_foo in order to fetch the next page of the list.
 * limit: Maximum number of messages to return
 * order: Sort order by the created_at timestamp of the objects. asc for ascending order and desc for descending order.
 * role: Filter by role (user/assistant/system/tool)
 * return_message_object: Whether to return Message objects or LettaMessage objects
 * user_id: ID of the user making the request
 *
 * Returns:
 * A list of messages associated with the run. Default is List[LettaMessage].
 * @param data The data for the request.
 * @param data.runId
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Maximum number of messages to return
 * @param data.order Sort order by the created_at timestamp of the objects. asc for ascending order and desc for descending order.
 * @param data.role Filter by role
 * @param data.userId
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunMessagesKeyFn(
      { after, before, limit, order, role, runId, userId },
      queryKey,
    ),
    queryFn: () =>
      RunsService.listRunMessages({
        after,
        before,
        limit,
        order,
        role,
        runId,
        userId,
      }) as TData,
    ...options,
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
export const useRunsServiceRetrieveRunUsage = <
  TData = Common.RunsServiceRetrieveRunUsageDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    runId,
    userId,
  }: {
    runId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceRetrieveRunUsageKeyFn(
      { runId, userId },
      queryKey,
    ),
    queryFn: () => RunsService.retrieveRunUsage({ runId, userId }) as TData,
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
    userId,
  }: {
    after?: string;
    before?: string;
    limit?: number;
    order?: string;
    runId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunStepsKeyFn(
      { after, before, limit, order, runId, userId },
      queryKey,
    ),
    queryFn: () =>
      RunsService.listRunSteps({
        after,
        before,
        limit,
        order,
        runId,
        userId,
      }) as TData,
    ...options,
  });
/**
 * List Steps
 * List steps with optional pagination and date filters.
 * Dates should be provided in ISO 8601 format (e.g. 2025-01-29T15:01:19-08:00)
 * @param data The data for the request.
 * @param data.before Return steps before this step ID
 * @param data.after Return steps after this step ID
 * @param data.limit Maximum number of steps to return
 * @param data.order Sort order (asc or desc)
 * @param data.startDate Return steps after this ISO datetime (e.g. "2025-01-29T15:01:19-08:00")
 * @param data.endDate Return steps before this ISO datetime (e.g. "2025-01-29T15:01:19-08:00")
 * @param data.model Filter by the name of the model used for the step
 * @param data.agentId Filter by the ID of the agent that performed the step
 * @param data.traceIds Filter by trace ids returned by the server
 * @param data.userId
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
    limit,
    model,
    order,
    startDate,
    traceIds,
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
    traceIds?: string[];
    userId?: string;
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
        limit,
        model,
        order,
        startDate,
        traceIds,
        userId,
      },
      queryKey,
    ),
    queryFn: () =>
      StepsService.listSteps({
        after,
        agentId,
        before,
        endDate,
        limit,
        model,
        order,
        startDate,
        traceIds,
        userId,
      }) as TData,
    ...options,
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
export const useStepsServiceRetrieveStep = <
  TData = Common.StepsServiceRetrieveStepDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseStepsServiceRetrieveStepKeyFn(
      { stepId, userId },
      queryKey,
    ),
    queryFn: () => StepsService.retrieveStep({ stepId, userId }) as TData,
    ...options,
  });
/**
 * List Tags
 * Get a list of all tags in the database
 * @param data The data for the request.
 * @param data.after
 * @param data.limit
 * @param data.queryText
 * @param data.userId
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
    limit,
    queryText,
    userId,
  }: {
    after?: string;
    limit?: number;
    queryText?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseTagServiceListTagsKeyFn(
      { after, limit, queryText, userId },
      queryKey,
    ),
    queryFn: () =>
      TagService.listTags({ after, limit, queryText, userId }) as TData,
    ...options,
  });
/**
 * List Tags
 * Get a list of all tags in the database
 * @param data The data for the request.
 * @param data.after
 * @param data.limit
 * @param data.queryText
 * @param data.userId
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
    limit,
    queryText,
    userId,
  }: {
    after?: string;
    limit?: number;
    queryText?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListTagsKeyFn(
      { after, limit, queryText, userId },
      queryKey,
    ),
    queryFn: () =>
      AdminService.listTags({ after, limit, queryText, userId }) as TData,
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
 * Retrieve Provider Trace By Step Id
 * @param data The data for the request.
 * @param data.stepId
 * @param data.userId
 * @returns ProviderTrace Successful Response
 * @throws ApiError
 */
export const useTelemetryServiceRetrieveProviderTrace = <
  TData = Common.TelemetryServiceRetrieveProviderTraceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    stepId,
    userId,
  }: {
    stepId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseTelemetryServiceRetrieveProviderTraceKeyFn(
      { stepId, userId },
      queryKey,
    ),
    queryFn: () =>
      TelemetryService.retrieveProviderTrace({ stepId, userId }) as TData,
    ...options,
  });
/**
 * List Batch Runs
 * List all batch runs.
 * @param data The data for the request.
 * @param data.userId
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const useMessagesServiceListBatchRuns = <
  TData = Common.MessagesServiceListBatchRunsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseMessagesServiceListBatchRunsKeyFn({ userId }, queryKey),
    queryFn: () => MessagesService.listBatchRuns({ userId }) as TData,
    ...options,
  });
/**
 * Retrieve Batch Run
 * Get the status of a batch run.
 * @param data The data for the request.
 * @param data.batchId
 * @param data.userId
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const useMessagesServiceRetrieveBatchRun = <
  TData = Common.MessagesServiceRetrieveBatchRunDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    batchId,
    userId,
  }: {
    batchId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseMessagesServiceRetrieveBatchRunKeyFn(
      { batchId, userId },
      queryKey,
    ),
    queryFn: () =>
      MessagesService.retrieveBatchRun({ batchId, userId }) as TData,
    ...options,
  });
/**
 * List Batch Messages
 * Get messages for a specific batch job.
 *
 * Returns messages associated with the batch in chronological order.
 *
 * Pagination:
 * - For the first page, omit the cursor parameter
 * - For subsequent pages, use the ID of the last message from the previous response as the cursor
 * - Results will include messages before/after the cursor based on sort_descending
 * @param data The data for the request.
 * @param data.batchId
 * @param data.limit Maximum number of messages to return
 * @param data.cursor Message ID to use as pagination cursor (get messages before/after this ID) depending on sort_descending.
 * @param data.agentId Filter messages by agent ID
 * @param data.sortDescending Sort messages by creation time (true=newest first)
 * @param data.userId
 * @returns LettaBatchMessages Successful Response
 * @throws ApiError
 */
export const useMessagesServiceListBatchMessages = <
  TData = Common.MessagesServiceListBatchMessagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseMessagesServiceListBatchMessagesKeyFn(
      { agentId, batchId, cursor, limit, sortDescending, userId },
      queryKey,
    ),
    queryFn: () =>
      MessagesService.listBatchMessages({
        agentId,
        batchId,
        cursor,
        limit,
        sortDescending,
        userId,
      }) as TData,
    ...options,
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
export const useEmbeddingsServiceGetTotalStorageSize = <
  TData = Common.EmbeddingsServiceGetTotalStorageSizeDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    storageUnit,
    userId,
  }: {
    storageUnit?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseEmbeddingsServiceGetTotalStorageSizeKeyFn(
      { storageUnit, userId },
      queryKey,
    ),
    queryFn: () =>
      EmbeddingsService.getTotalStorageSize({ storageUnit, userId }) as TData,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      ToolsService.createTool({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upsert Base Tools
 * Upsert base tools
 * @param data The data for the request.
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ userId }) =>
      ToolsService.addBaseTools({ userId }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Run Tool From Source
 * Attempt to build a tool from source, then run it on the provided arguments
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      ToolsService.runToolFromSource({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Add Composio Tool
 * Add a new Composio tool by action name (Composio refers to each tool as an `Action`)
 * @param data The data for the request.
 * @param data.composioActionName
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ composioActionName, userId }) =>
      ToolsService.addComposioTool({
        composioActionName,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ mcpServerName, mcpToolName, userId }) =>
      ToolsService.addMcpTool({
        mcpServerName,
        mcpToolName,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Source
 * Create a new data source.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      SourcesService.createSource({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upload File To Source
 * Upload a file to a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.formData
 * @param data.userId
 * @returns Job Successful Response
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
        formData: Body_upload_file_to_source;
        sourceId: string;
        userId?: string;
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
      formData: Body_upload_file_to_source;
      sourceId: string;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ formData, sourceId, userId }) =>
      SourcesService.uploadFileToSource({
        formData,
        sourceId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Agent
 * Create a new agent with the specified configuration.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.xProject
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
        userId?: string;
        xProject?: string;
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
      userId?: string;
      xProject?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId, xProject }) =>
      AgentsService.createAgent({
        requestBody,
        userId,
        xProject,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Import Agent Serialized
 * Import a serialized agent file and recreate the agent in the system.
 * @param data The data for the request.
 * @param data.formData
 * @param data.appendCopySuffix If set to True, appends "_copy" to the end of the agent name.
 * @param data.overrideExistingTools If set to True, existing tools can get their source code overwritten by the uploaded tool definitions. Note that Letta core tools can never be updated externally.
 * @param data.projectId The project ID to associate the uploaded agent with.
 * @param data.stripMessages If set to True, strips all messages from the agent before importing.
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceImportAgentSerialized = <
  TData = Common.AgentsServiceImportAgentSerializedMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        appendCopySuffix?: boolean;
        formData: Body_import_agent_serialized;
        overrideExistingTools?: boolean;
        projectId?: string;
        stripMessages?: boolean;
        userId?: string;
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
      appendCopySuffix?: boolean;
      formData: Body_import_agent_serialized;
      overrideExistingTools?: boolean;
      projectId?: string;
      stripMessages?: boolean;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({
      appendCopySuffix,
      formData,
      overrideExistingTools,
      projectId,
      stripMessages,
      userId,
    }) =>
      AgentsService.importAgentSerialized({
        appendCopySuffix,
        formData,
        overrideExistingTools,
        projectId,
        stripMessages,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userId }) =>
      AgentsService.createPassage({
        agentId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userId }) =>
      AgentsService.sendMessage({
        agentId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userId }) =>
      AgentsService.createAgentMessageStream({
        agentId,
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Send Message Async
 * Asynchronously process a user message and return a run object.
 * The actual processing happens in the background, and the status can be checked using the run ID.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.callbackUrl Optional callback URL to POST to when the job completes
 * @param data.userId
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
        callbackUrl?: string;
        requestBody: LettaRequest;
        userId?: string;
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
      callbackUrl?: string;
      requestBody: LettaRequest;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, callbackUrl, requestBody, userId }) =>
      AgentsService.createAgentMessageAsync({
        agentId,
        callbackUrl,
        requestBody,
        userId,
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
 * @returns AgentState Successful Response
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, maxMessageLength, userId }) =>
      AgentsService.summarizeAgentConversation({
        agentId,
        maxMessageLength,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Group
 * Create a new multi-agent group with the specified configuration.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.xProject
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
        userId?: string;
        xProject?: string;
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
      userId?: string;
      xProject?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId, xProject }) =>
      GroupsService.createGroup({
        requestBody,
        userId,
        xProject,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, requestBody, userId }) =>
      GroupsService.sendGroupMessage({
        groupId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, requestBody, userId }) =>
      GroupsService.sendGroupMessageStreaming({
        groupId,
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Identity
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.xProject
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
        userId?: string;
        xProject?: string;
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
      userId?: string;
      xProject?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId, xProject }) =>
      IdentitiesService.createIdentity({
        requestBody,
        userId,
        xProject,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Block
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      BlocksService.createBlock({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Sandbox Config
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      SandboxConfigService.createSandboxConfigV1SandboxConfigPost({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Default E2B Sandbox Config
 * @param data The data for the request.
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ userId }) =>
        SandboxConfigService.createDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPost(
          { userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Create Default Local Sandbox Config
 * @param data The data for the request.
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ userId }) =>
        SandboxConfigService.createDefaultLocalSandboxConfigV1SandboxConfigLocalDefaultPost(
          { userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Create Custom Local Sandbox Config
 * Create or update a custom LocalSandboxConfig, including pip_requirements.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ requestBody, userId }) =>
        SandboxConfigService.createCustomLocalSandboxConfigV1SandboxConfigLocalPost(
          { requestBody, userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Force Recreate Local Sandbox Venv
 * Forcefully recreate the virtual environment for the local sandbox.
 * Deletes and recreates the venv, then reinstalls required dependencies.
 * @param data The data for the request.
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ userId }) =>
        SandboxConfigService.forceRecreateLocalSandboxVenvV1SandboxConfigLocalRecreateVenvPost(
          { userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Create Sandbox Env Var
 * @param data The data for the request.
 * @param data.sandboxConfigId
 * @param data.requestBody
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ requestBody, sandboxConfigId, userId }) =>
        SandboxConfigService.createSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePost(
          { requestBody, sandboxConfigId, userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Create Provider
 * Create a new custom provider
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      ProvidersService.createProvider({
        requestBody,
        userId,
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
 * Create Messages Batch
 * Submit a batch of agent messages for asynchronous processing.
 * Creates a job that will fan out messages to all listed agents and process them in parallel.
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @returns BatchJob Successful Response
 * @throws ApiError
 */
export const useMessagesServiceCreateMessagesBatch = <
  TData = Common.MessagesServiceCreateMessagesBatchMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CreateBatch;
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      MessagesService.createMessagesBatch({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Create Voice Chat Completions
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userId }) =>
      VoiceService.createVoiceChatCompletions({
        agentId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      ToolsService.upsertTool({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Add Mcp Server To Config
 * Add a new MCP server to the Letta MCP server config
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
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
        requestBody: StdioServerConfig | SSEServerConfig;
        userId?: string;
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
      requestBody: StdioServerConfig | SSEServerConfig;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      ToolsService.addMcpServer({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upsert Identity
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @param data.xProject
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
        userId?: string;
        xProject?: string;
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
      userId?: string;
      xProject?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId, xProject }) =>
      IdentitiesService.upsertIdentity({
        requestBody,
        userId,
        xProject,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Upsert Identity Properties
 * @param data The data for the request.
 * @param data.identityId
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ identityId, requestBody, userId }) =>
      IdentitiesService.upsertIdentityProperties({
        identityId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, toolId, userId }) =>
      ToolsService.modifyTool({
        requestBody,
        toolId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Source
 * Update the name or documentation of an existing data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, sourceId, userId }) =>
      SourcesService.modifySource({
        requestBody,
        sourceId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Agent
 * Update an existing agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userId }) =>
      AgentsService.modifyAgent({
        agentId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, toolId, userId }) =>
      AgentsService.attachTool({
        agentId,
        toolId,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, toolId, userId }) =>
      AgentsService.detachTool({
        agentId,
        toolId,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, sourceId, userId }) =>
      AgentsService.attachSourceToAgent({
        agentId,
        sourceId,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, sourceId, userId }) =>
      AgentsService.detachSourceFromAgent({
        agentId,
        sourceId,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, blockLabel, requestBody, userId }) =>
      AgentsService.modifyCoreMemoryBlock({
        agentId,
        blockLabel,
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Attach Block
 * Attach a core memoryblock to an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, blockId, userId }) =>
      AgentsService.attachCoreMemoryBlock({
        agentId,
        blockId,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, blockId, userId }) =>
      AgentsService.detachCoreMemoryBlock({
        agentId,
        blockId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Passage
 * Modify a memory in the agent's archival memory store.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.memoryId
 * @param data.requestBody
 * @param data.userId
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useAgentsServiceModifyPassage = <
  TData = Common.AgentsServiceModifyPassageMutationResult,
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
        requestBody: PassageUpdate;
        userId?: string;
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
      requestBody: PassageUpdate;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, memoryId, requestBody, userId }) =>
      AgentsService.modifyPassage({
        agentId,
        memoryId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, messageId, requestBody, userId }) =>
      AgentsService.modifyMessage({
        agentId,
        messageId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ addDefaultInitialMessages, agentId, userId }) =>
      AgentsService.resetMessages({
        addDefaultInitialMessages,
        agentId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Group
 * Create a new multi-agent group with the specified configuration.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.requestBody
 * @param data.userId
 * @param data.xProject
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
        userId?: string;
        xProject?: string;
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
      userId?: string;
      xProject?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, requestBody, userId, xProject }) =>
      GroupsService.modifyGroup({
        groupId,
        requestBody,
        userId,
        xProject,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, messageId, requestBody, userId }) =>
      GroupsService.modifyGroupMessage({
        groupId,
        messageId,
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Reset Group Messages
 * Delete the group messages for all agents that are part of the multi-agent group.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, userId }) =>
      GroupsService.resetGroupMessages({
        groupId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Identity
 * @param data The data for the request.
 * @param data.identityId
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ identityId, requestBody, userId }) =>
      IdentitiesService.updateIdentity({
        identityId,
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Modify Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ blockId, requestBody, userId }) =>
      BlocksService.modifyBlock({
        blockId,
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Sandbox Config
 * @param data The data for the request.
 * @param data.sandboxConfigId
 * @param data.requestBody
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ requestBody, sandboxConfigId, userId }) =>
        SandboxConfigService.updateSandboxConfigV1SandboxConfigSandboxConfigIdPatch(
          { requestBody, sandboxConfigId, userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Update Sandbox Env Var
 * @param data The data for the request.
 * @param data.envVarId
 * @param data.requestBody
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ envVarId, requestBody, userId }) =>
        SandboxConfigService.updateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatch(
          { envVarId, requestBody, userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Modify Provider
 * Update an existing custom provider
 * @param data The data for the request.
 * @param data.providerId
 * @param data.requestBody
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ providerId, requestBody, userId }) =>
      ProvidersService.modifyProvider({
        providerId,
        requestBody,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ stepId, transactionId, userId }) =>
      StepsService.updateStepTransactionId({
        stepId,
        transactionId,
        userId,
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
 * Cancel Batch Run
 * Cancel a batch run.
 * @param data The data for the request.
 * @param data.batchId
 * @param data.userId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useMessagesServiceCancelBatchRun = <
  TData = Common.MessagesServiceCancelBatchRunMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        batchId: string;
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ batchId, userId }) =>
      MessagesService.cancelBatchRun({
        batchId,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ toolId, userId }) =>
      ToolsService.deleteTool({ toolId, userId }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Mcp Server From Config
 * Add a new MCP server to the Letta MCP server config
 * @param data The data for the request.
 * @param data.mcpServerName
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ mcpServerName, userId }) =>
      ToolsService.deleteMcpServer({
        mcpServerName,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Source
 * Delete a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ sourceId, userId }) =>
      SourcesService.deleteSource({
        sourceId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete File From Source
 * Delete a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.fileId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ fileId, sourceId, userId }) =>
      SourcesService.deleteFileFromSource({
        fileId,
        sourceId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Agent
 * Delete an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, userId }) =>
      AgentsService.deleteAgent({
        agentId,
        userId,
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, memoryId, userId }) =>
      AgentsService.deletePassage({
        agentId,
        memoryId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Group
 * Delete a multi-agent group.
 * @param data The data for the request.
 * @param data.groupId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ groupId, userId }) =>
      GroupsService.deleteGroup({
        groupId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Identity
 * Delete an identity by its identifier key
 * @param data The data for the request.
 * @param data.identityId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ identityId, userId }) =>
      IdentitiesService.deleteIdentity({
        identityId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
 * @returns Block Successful Response
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ blockId, userId }) =>
      BlocksService.deleteBlock({
        blockId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Job
 * Delete a job by its job_id.
 * @param data The data for the request.
 * @param data.jobId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ jobId, userId }) =>
      JobsService.deleteJob({ jobId, userId }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Sandbox Config
 * @param data The data for the request.
 * @param data.sandboxConfigId
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ sandboxConfigId, userId }) =>
        SandboxConfigService.deleteSandboxConfigV1SandboxConfigSandboxConfigIdDelete(
          { sandboxConfigId, userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Delete Sandbox Env Var
 * @param data The data for the request.
 * @param data.envVarId
 * @param data.userId
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
          userId?: string;
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
        userId?: string;
      },
      TContext
    >({
      mutationFn: ({ envVarId, userId }) =>
        SandboxConfigService.deleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDelete(
          { envVarId, userId },
        ) as unknown as Promise<TData>,
      ...options,
    });
/**
 * Delete Provider
 * Delete an existing custom provider
 * @param data The data for the request.
 * @param data.providerId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ providerId, userId }) =>
      ProvidersService.deleteProvider({
        providerId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Delete Run
 * Delete a run by its run_id.
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
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
        userId?: string;
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
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ runId, userId }) =>
      RunsService.deleteRun({ runId, userId }) as unknown as Promise<TData>,
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

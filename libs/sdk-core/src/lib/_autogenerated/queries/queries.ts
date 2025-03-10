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
  AuthRequest,
  BlockUpdate,
  Body_upload_agent_serialized,
  Body_upload_file_to_source,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
  CreateAgentRequest,
  CreateArchivalMemory,
  CreateBlock,
  IdentityCreate,
  IdentityType,
  IdentityUpdate,
  LettaRequest,
  LettaStreamingRequest,
  LocalSandboxConfig,
  MessageRole,
  OrganizationCreate,
  PassageUpdate,
  ProviderCreate,
  ProviderUpdate,
  SandboxConfigCreate,
  SandboxConfigUpdate,
  SandboxEnvironmentVariableCreate,
  SandboxEnvironmentVariableUpdate,
  SandboxType,
  SourceCreate,
  SourceUpdate,
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
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn(
      { sourceId, userId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listSourcePassages({ sourceId, userId }) as TData,
    ...options,
  });
/**
 * List Source Files
 * List paginated files associated with a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.limit Number of files to return
 * @param data.after Pagination cursor to fetch the next set of results
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
    limit,
    sourceId,
    userId,
  }: {
    after?: string;
    limit?: number;
    sourceId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourceFilesKeyFn(
      { after, limit, sourceId, userId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listSourceFiles({
        after,
        limit,
        sourceId,
        userId,
      }) as TData,
    ...options,
  });
/**
 * List Agents
 * List all agents associated with a given user.
 * This endpoint retrieves a list of all agents and their configurations associated with the specified user ID.
 * @param data The data for the request.
 * @param data.name Name of the agent
 * @param data.tags List of tags to filter agents by
 * @param data.matchAllTags If True, only returns agents that match ALL given tags. Otherwise, return agents that have ANY of the passed in tags.
 * @param data.before Cursor for pagination
 * @param data.after Cursor for pagination
 * @param data.limit Limit for pagination
 * @param data.queryText Search agents by name
 * @param data.projectId Search agents by project id
 * @param data.templateId Search agents by template id
 * @param data.baseTemplateId Search agents by base template id
 * @param data.identifierId Search agents by identifier id
 * @param data.identifierKeys Search agents by identifier keys
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
    baseTemplateId,
    before,
    identifierId,
    identifierKeys,
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
    baseTemplateId?: string;
    before?: string;
    identifierId?: string;
    identifierKeys?: string[];
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
        baseTemplateId,
        before,
        identifierId,
        identifierKeys,
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
        baseTemplateId,
        before,
        identifierId,
        identifierKeys,
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
 * Download Agent Serialized
 * Download the serialized JSON representation of an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDownloadAgentSerialized = <
  TData = Common.AgentsServiceDownloadAgentSerializedDefaultResponse,
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
    queryKey: Common.UseAgentsServiceDownloadAgentSerializedKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.downloadAgentSerialized({ agentId, userId }) as TData,
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
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceRetrieveAgentKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () => AgentsService.retrieveAgent({ agentId, userId }) as TData,
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListPassagesKeyFn(
      { after, agentId, before, limit, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listPassages({
        after,
        agentId,
        before,
        limit,
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
    limit,
    useAssistantMessage,
    userId,
  }: {
    after?: string;
    agentId: string;
    assistantMessageToolKwarg?: string;
    assistantMessageToolName?: string;
    before?: string;
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
 * List Llm Backends
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const useModelsServiceListModels = <
  TData = Common.ModelsServiceListModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListModelsKeyFn(queryKey),
    queryFn: () => ModelsService.listModels() as TData,
    ...options,
  });
/**
 * List Embedding Backends
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const useModelsServiceListEmbeddingModels = <
  TData = Common.ModelsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn(queryKey),
    queryFn: () => ModelsService.listEmbeddingModels() as TData,
    ...options,
  });
/**
 * List Llm Backends
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const useLlmsServiceListModels = <
  TData = Common.LlmsServiceListModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListModelsKeyFn(queryKey),
    queryFn: () => LlmsService.listModels() as TData,
    ...options,
  });
/**
 * List Embedding Backends
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const useLlmsServiceListEmbeddingModels = <
  TData = Common.LlmsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn(queryKey),
    queryFn: () => LlmsService.listEmbeddingModels() as TData,
    ...options,
  });
/**
 * List Blocks
 * @param data The data for the request.
 * @param data.label Labels to include (e.g. human, persona)
 * @param data.templatesOnly Whether to include only templates
 * @param data.name Name of the block
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceListBlocksKeyFn(
      { label, name, templatesOnly, userId },
      queryKey,
    ),
    queryFn: () =>
      BlocksService.listBlocks({ label, name, templatesOnly, userId }) as TData,
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
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn({ userId }, queryKey),
    queryFn: () => JobsService.listActiveJobs({ userId }) as TData,
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
    userId,
  }: {
    after?: string;
    limit?: number;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseProvidersServiceListProvidersKeyFn(
      { after, limit, userId },
      queryKey,
    ),
    queryFn: () =>
      ProvidersService.listProviders({ after, limit, userId }) as TData,
    ...options,
  });
/**
 * List Runs
 * List all runs.
 * @param data The data for the request.
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
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListRunsKeyFn({ userId }, queryKey),
    queryFn: () => RunsService.listRuns({ userId }) as TData,
    ...options,
  });
/**
 * List Active Runs
 * List all active runs.
 * @param data The data for the request.
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
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceListActiveRunsKeyFn({ userId }, queryKey),
    queryFn: () => RunsService.listActiveRuns({ userId }) as TData,
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
 * Upload Agent Serialized
 * Upload a serialized agent JSON file and recreate the agent in the system.
 * @param data The data for the request.
 * @param data.formData
 * @param data.appendCopySuffix If set to True, appends "_copy" to the end of the agent name.
 * @param data.overrideExistingTools If set to True, existing tools can get their source code overwritten by the uploaded tool definitions. Note that Letta core tools can never be updated externally.
 * @param data.projectId The project ID to associate the uploaded agent with.
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceUploadAgentSerialized = <
  TData = Common.AgentsServiceUploadAgentSerializedMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        appendCopySuffix?: boolean;
        formData: Body_upload_agent_serialized;
        overrideExistingTools?: boolean;
        projectId?: string;
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
      formData: Body_upload_agent_serialized;
      overrideExistingTools?: boolean;
      projectId?: string;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({
      appendCopySuffix,
      formData,
      overrideExistingTools,
      projectId,
      userId,
    }) =>
      AgentsService.uploadAgentSerialized({
        appendCopySuffix,
        formData,
        overrideExistingTools,
        projectId,
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
      AgentsService.createAgentMessageAsync({
        agentId,
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
        requestBody:
          | CompletionCreateParamsNonStreaming
          | CompletionCreateParamsStreaming;
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
      requestBody:
        | CompletionCreateParamsNonStreaming
        | CompletionCreateParamsStreaming;
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
      IdentitiesService.upsertIdentity({
        requestBody,
        userId,
        xProject,
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
      requestBody: ProviderUpdate;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      ProvidersService.modifyProvider({
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
 * @param data.providerId The provider_id key to be deleted.
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

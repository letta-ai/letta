// generated with @7nohe/openapi-react-query-codegen@1.6.0

import {
  useMutation,
  UseMutationOptions,
  useQuery,
  UseQueryOptions,
} from '@tanstack/react-query';
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
  ProvidersService,
  RunsService,
  SandboxConfigService,
  SourcesService,
  TagService,
  ToolsService,
  UsersService,
} from '../requests/services.gen';
import {
  AuthRequest,
  BlockUpdate,
  Body_upload_file_to_source,
  CreateAgentRequest,
  CreateArchivalMemory,
  CreateBlock,
  LettaRequest,
  LettaStreamingRequest,
  MessageRole,
  MessageUpdate,
  OrganizationCreate,
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
  UserCreate,
  UserUpdate,
} from '../requests/types.gen';
import * as Common from './common';
/**
 * Get Tool
 * Get a tool by ID
 * @param data The data for the request.
 * @param data.toolId
 * @param data.userId
 * @returns letta__schemas__tool__Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceGetTool = <
  TData = Common.ToolsServiceGetToolDefaultResponse,
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
    queryKey: Common.UseToolsServiceGetToolKeyFn({ toolId, userId }, queryKey),
    queryFn: () => ToolsService.getTool({ toolId, userId }) as TData,
    ...options,
  });
/**
 * List Tools
 * Get a list of all tools available to agents belonging to the org of the user
 * @param data The data for the request.
 * @param data.cursor
 * @param data.limit
 * @param data.userId
 * @returns letta__schemas__tool__Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceListTools = <
  TData = Common.ToolsServiceListToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    cursor,
    limit,
    userId,
  }: {
    cursor?: string;
    limit?: number;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListToolsKeyFn(
      { cursor, limit, userId },
      queryKey,
    ),
    queryFn: () => ToolsService.listTools({ cursor, limit, userId }) as TData,
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
 * Get Source
 * Get all sources
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceGetSource = <
  TData = Common.SourcesServiceGetSourceDefaultResponse,
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
    queryKey: Common.UseSourcesServiceGetSourceKeyFn(
      { sourceId, userId },
      queryKey,
    ),
    queryFn: () => SourcesService.getSource({ sourceId, userId }) as TData,
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
 * List Passages
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
 * List Files From Source
 * List paginated files associated with a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.limit Number of files to return
 * @param data.cursor Pagination cursor to fetch the next set of results
 * @param data.userId
 * @returns FileMetadata Successful Response
 * @throws ApiError
 */
export const useSourcesServiceListFilesFromSource = <
  TData = Common.SourcesServiceListFilesFromSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
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
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListFilesFromSourceKeyFn(
      { cursor, limit, sourceId, userId },
      queryKey,
    ),
    queryFn: () =>
      SourcesService.listFilesFromSource({
        cursor,
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
 * @param data.cursor Cursor for pagination
 * @param data.limit Limit for pagination
 * @param data.queryText Search agents by name
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
    cursor,
    limit,
    matchAllTags,
    name,
    queryText,
    tags,
    userId,
  }: {
    cursor?: string;
    limit?: number;
    matchAllTags?: boolean;
    name?: string;
    queryText?: string;
    tags?: string[];
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn(
      { cursor, limit, matchAllTags, name, queryText, tags, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgents({
        cursor,
        limit,
        matchAllTags,
        name,
        queryText,
        tags,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Get Agent Context Window
 * Retrieve the context window of a specific agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns ContextWindowOverview Successful Response
 * @throws ApiError
 */
export const useAgentsServiceGetAgentContextWindow = <
  TData = Common.AgentsServiceGetAgentContextWindowDefaultResponse,
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
    queryKey: Common.UseAgentsServiceGetAgentContextWindowKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.getAgentContextWindow({ agentId, userId }) as TData,
    ...options,
  });
/**
 * Get Agent State
 * Get the state of the agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceGetAgent = <
  TData = Common.AgentsServiceGetAgentDefaultResponse,
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
    queryKey: Common.UseAgentsServiceGetAgentKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () => AgentsService.getAgent({ agentId, userId }) as TData,
    ...options,
  });
/**
 * Get Tools From Agent
 * Get tools from an existing agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns letta__schemas__tool__Tool Successful Response
 * @throws ApiError
 */
export const useAgentsServiceGetToolsFromAgent = <
  TData = Common.AgentsServiceGetToolsFromAgentDefaultResponse,
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
    queryKey: Common.UseAgentsServiceGetToolsFromAgentKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.getToolsFromAgent({ agentId, userId }) as TData,
    ...options,
  });
/**
 * Get Agent Sources
 * Get the sources associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useAgentsServiceGetAgentSources = <
  TData = Common.AgentsServiceGetAgentSourcesDefaultResponse,
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
    queryKey: Common.UseAgentsServiceGetAgentSourcesKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () => AgentsService.getAgentSources({ agentId, userId }) as TData,
    ...options,
  });
/**
 * Get Agent Memory
 * Retrieve the memory state of a specific agent.
 * This endpoint fetches the current memory state of the agent identified by the user ID and agent ID.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Memory Successful Response
 * @throws ApiError
 */
export const useAgentsServiceGetAgentMemory = <
  TData = Common.AgentsServiceGetAgentMemoryDefaultResponse,
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
    queryKey: Common.UseAgentsServiceGetAgentMemoryKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () => AgentsService.getAgentMemory({ agentId, userId }) as TData,
    ...options,
  });
/**
 * Get Agent Memory Block
 * Retrieve a memory block from an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockLabel
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useAgentsServiceGetAgentMemoryBlock = <
  TData = Common.AgentsServiceGetAgentMemoryBlockDefaultResponse,
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
    queryKey: Common.UseAgentsServiceGetAgentMemoryBlockKeyFn(
      { agentId, blockLabel, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.getAgentMemoryBlock({
        agentId,
        blockLabel,
        userId,
      }) as TData,
    ...options,
  });
/**
 * List Agent Memory Blocks
 * Retrieve the memory blocks of a specific agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentMemoryBlocks = <
  TData = Common.AgentsServiceListAgentMemoryBlocksDefaultResponse,
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
    queryKey: Common.UseAgentsServiceListAgentMemoryBlocksKeyFn(
      { agentId, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentMemoryBlocks({ agentId, userId }) as TData,
    ...options,
  });
/**
 * Get Agent Archival Memory
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
export const useAgentsServiceListAgentArchivalMemory = <
  TData = Common.AgentsServiceListAgentArchivalMemoryDefaultResponse,
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
    queryKey: Common.UseAgentsServiceListAgentArchivalMemoryKeyFn(
      { after, agentId, before, limit, userId },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentArchivalMemory({
        after,
        agentId,
        before,
        limit,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Get Agent Messages
 * Retrieve message history for an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.before Message before which to retrieve the returned messages.
 * @param data.limit Maximum number of messages to retrieve.
 * @param data.msgObject If true, returns Message objects. If false, return LettaMessage objects.
 * @param data.assistantMessageToolName The name of the designated message tool.
 * @param data.assistantMessageToolKwarg The name of the message argument in the designated message tool.
 * @param data.userId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServiceListAgentMessages = <
  TData = Common.AgentsServiceListAgentMessagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    agentId,
    assistantMessageToolKwarg,
    assistantMessageToolName,
    before,
    limit,
    msgObject,
    userId,
  }: {
    agentId: string;
    assistantMessageToolKwarg?: string;
    assistantMessageToolName?: string;
    before?: string;
    limit?: number;
    msgObject?: boolean;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentMessagesKeyFn(
      {
        agentId,
        assistantMessageToolKwarg,
        assistantMessageToolName,
        before,
        limit,
        msgObject,
        userId,
      },
      queryKey,
    ),
    queryFn: () =>
      AgentsService.listAgentMessages({
        agentId,
        assistantMessageToolKwarg,
        assistantMessageToolName,
        before,
        limit,
        msgObject,
        userId,
      }) as TData,
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
export const useBlocksServiceListMemoryBlocks = <
  TData = Common.BlocksServiceListMemoryBlocksDefaultResponse,
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
    queryKey: Common.UseBlocksServiceListMemoryBlocksKeyFn(
      { label, name, templatesOnly, userId },
      queryKey,
    ),
    queryFn: () =>
      BlocksService.listMemoryBlocks({
        label,
        name,
        templatesOnly,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Get Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceGetMemoryBlock = <
  TData = Common.BlocksServiceGetMemoryBlockDefaultResponse,
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
    queryKey: Common.UseBlocksServiceGetMemoryBlockKeyFn(
      { blockId, userId },
      queryKey,
    ),
    queryFn: () => BlocksService.getMemoryBlock({ blockId, userId }) as TData,
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
 * Get Job
 * Get the status of a job.
 * @param data The data for the request.
 * @param data.jobId
 * @param data.userId
 * @returns Job Successful Response
 * @throws ApiError
 */
export const useJobsServiceGetJob = <
  TData = Common.JobsServiceGetJobDefaultResponse,
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
    queryKey: Common.UseJobsServiceGetJobKeyFn({ jobId, userId }, queryKey),
    queryFn: () => JobsService.getJob({ jobId, userId }) as TData,
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
 * @param data.cursor Pagination cursor to fetch the next set of results
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
    cursor,
    limit,
    sandboxType,
    userId,
  }: {
    cursor?: string;
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
        { cursor, limit, sandboxType, userId },
        queryKey,
      ),
    queryFn: () =>
      SandboxConfigService.listSandboxConfigsV1SandboxConfigGet({
        cursor,
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
 * @param data.cursor Pagination cursor to fetch the next set of results
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
      cursor,
      limit,
      sandboxConfigId,
      userId,
    }: {
      cursor?: string;
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
          { cursor, limit, sandboxConfigId, userId },
          queryKey,
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
          { cursor, limit, sandboxConfigId, userId },
        ) as TData,
      ...options,
    });
/**
 * List Providers
 * Get a list of all custom providers in the database
 * @param data The data for the request.
 * @param data.cursor
 * @param data.limit
 * @returns Provider Successful Response
 * @throws ApiError
 */
export const useProvidersServiceListProviders = <
  TData = Common.ProvidersServiceListProvidersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseProvidersServiceListProvidersKeyFn(
      { cursor, limit },
      queryKey,
    ),
    queryFn: () => ProvidersService.listProviders({ cursor, limit }) as TData,
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
 * Get Run
 * Get the status of a run.
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const useRunsServiceGetRun = <
  TData = Common.RunsServiceGetRunDefaultResponse,
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
    queryKey: Common.UseRunsServiceGetRunKeyFn({ runId, userId }, queryKey),
    queryFn: () => RunsService.getRun({ runId, userId }) as TData,
    ...options,
  });
/**
 * Get Run Messages
 * Get messages associated with a run with filtering options.
 *
 * Args:
 * run_id: ID of the run
 * cursor: Cursor for pagination
 * limit: Maximum number of messages to return
 * ascending: Sort order by creation time
 * role: Filter by role (user/assistant/system/tool)
 * return_message_object: Whether to return Message objects or LettaMessage objects
 * user_id: ID of the user making the request
 *
 * Returns:
 * A list of messages associated with the run. Default is List[LettaMessage].
 * @param data The data for the request.
 * @param data.runId
 * @param data.cursor Cursor for pagination
 * @param data.limit Maximum number of messages to return
 * @param data.ascending Sort order by creation time
 * @param data.role Filter by role
 * @param data.userId
 * @returns LettaMessageUnion Successful Response
 * @throws ApiError
 */
export const useRunsServiceGetRunMessages = <
  TData = Common.RunsServiceGetRunMessagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[],
>(
  {
    ascending,
    cursor,
    limit,
    role,
    runId,
    userId,
  }: {
    ascending?: boolean;
    cursor?: string;
    limit?: number;
    role?: MessageRole;
    runId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseRunsServiceGetRunMessagesKeyFn(
      { ascending, cursor, limit, role, runId, userId },
      queryKey,
    ),
    queryFn: () =>
      RunsService.getRunMessages({
        ascending,
        cursor,
        limit,
        role,
        runId,
        userId,
      }) as TData,
    ...options,
  });
/**
 * Get Run Usage
 * Get usage statistics for a run.
 * @param data The data for the request.
 * @param data.runId
 * @param data.userId
 * @returns UsageStatistics Successful Response
 * @throws ApiError
 */
export const useRunsServiceGetRunUsage = <
  TData = Common.RunsServiceGetRunUsageDefaultResponse,
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
    queryKey: Common.UseRunsServiceGetRunUsageKeyFn(
      { runId, userId },
      queryKey,
    ),
    queryFn: () => RunsService.getRunUsage({ runId, userId }) as TData,
    ...options,
  });
/**
 * Get Tags
 * Get a list of all tags in the database
 * @param data The data for the request.
 * @param data.cursor
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
    cursor,
    limit,
    queryText,
    userId,
  }: {
    cursor?: string;
    limit?: number;
    queryText?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseTagServiceListTagsKeyFn(
      { cursor, limit, queryText, userId },
      queryKey,
    ),
    queryFn: () =>
      TagService.listTags({ cursor, limit, queryText, userId }) as TData,
    ...options,
  });
/**
 * Get Tags
 * Get a list of all tags in the database
 * @param data The data for the request.
 * @param data.cursor
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
    cursor,
    limit,
    queryText,
    userId,
  }: {
    cursor?: string;
    limit?: number;
    queryText?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListTagsKeyFn(
      { cursor, limit, queryText, userId },
      queryKey,
    ),
    queryFn: () =>
      AdminService.listTags({ cursor, limit, queryText, userId }) as TData,
    ...options,
  });
/**
 * List Users
 * Get a list of all users in the database
 * @param data The data for the request.
 * @param data.cursor
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
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListUsersKeyFn({ cursor, limit }, queryKey),
    queryFn: () => AdminService.listUsers({ cursor, limit }) as TData,
    ...options,
  });
/**
 * Get All Orgs
 * Get a list of all orgs in the database
 * @param data The data for the request.
 * @param data.cursor
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
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListOrgsKeyFn({ cursor, limit }, queryKey),
    queryFn: () => AdminService.listOrgs({ cursor, limit }) as TData,
    ...options,
  });
/**
 * List Users
 * Get a list of all users in the database
 * @param data The data for the request.
 * @param data.cursor
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
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseUsersServiceListUsersKeyFn({ cursor, limit }, queryKey),
    queryFn: () => UsersService.listUsers({ cursor, limit }) as TData,
    ...options,
  });
/**
 * Get All Orgs
 * Get a list of all orgs in the database
 * @param data The data for the request.
 * @param data.cursor
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
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseOrganizationServiceListOrgsKeyFn(
      { cursor, limit },
      queryKey,
    ),
    queryFn: () => OrganizationService.listOrgs({ cursor, limit }) as TData,
    ...options,
  });
/**
 * Create Tool
 * Create a new tool
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @returns letta__schemas__tool__Tool Successful Response
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
 * @returns letta__schemas__tool__Tool Successful Response
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
 * @returns letta__schemas__tool__Tool Successful Response
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
      },
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
    },
    TContext
  >({
    mutationFn: ({ requestBody, userId }) =>
      AgentsService.createAgent({
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Insert Agent Archival Memory
 * Insert a memory into an agent's archival memory store.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const useAgentsServiceCreateAgentArchivalMemory = <
  TData = Common.AgentsServiceCreateAgentArchivalMemoryMutationResult,
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
      AgentsService.createAgentArchivalMemory({
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
export const useAgentsServiceCreateAgentMessage = <
  TData = Common.AgentsServiceCreateAgentMessageMutationResult,
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
      AgentsService.createAgentMessage({
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
 * Create Block
 * @param data The data for the request.
 * @param data.requestBody
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceCreateMemoryBlock = <
  TData = Common.BlocksServiceCreateMemoryBlockMutationResult,
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
      BlocksService.createMemoryBlock({
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
 * @returns letta__schemas__tool__Tool Successful Response
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
 * Update Tool
 * Update an existing tool
 * @param data The data for the request.
 * @param data.toolId
 * @param data.requestBody
 * @param data.userId
 * @returns letta__schemas__tool__Tool Successful Response
 * @throws ApiError
 */
export const useToolsServiceUpdateTool = <
  TData = Common.ToolsServiceUpdateToolMutationResult,
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
      ToolsService.updateTool({
        requestBody,
        toolId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Source
 * Update the name or documentation of an existing data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.requestBody
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const useSourcesServiceUpdateSource = <
  TData = Common.SourcesServiceUpdateSourceMutationResult,
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
      SourcesService.updateSource({
        requestBody,
        sourceId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Agent
 * Update an existing agent
 * @param data The data for the request.
 * @param data.agentId
 * @param data.requestBody
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceUpdateAgent = <
  TData = Common.AgentsServiceUpdateAgentMutationResult,
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
      AgentsService.updateAgent({
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
export const useAgentsServiceAttachToolToAgent = <
  TData = Common.AgentsServiceAttachToolToAgentMutationResult,
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
      AgentsService.attachToolToAgent({
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
export const useAgentsServiceDetachToolFromAgent = <
  TData = Common.AgentsServiceDetachToolFromAgentMutationResult,
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
      AgentsService.detachToolFromAgent({
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
 * Update Agent Memory Block
 * Updates a memory block of an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockLabel
 * @param data.requestBody
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useAgentsServiceUpdateAgentMemoryBlockByLabel = <
  TData = Common.AgentsServiceUpdateAgentMemoryBlockByLabelMutationResult,
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
      AgentsService.updateAgentMemoryBlockByLabel({
        agentId,
        blockLabel,
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Attach Block
 * Attach a block to an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockId
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceAttachBlockToAgent = <
  TData = Common.AgentsServiceAttachBlockToAgentMutationResult,
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
      AgentsService.attachBlockToAgent({
        agentId,
        blockId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Detach Block
 * Detach a block from an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.blockId
 * @param data.userId
 * @returns AgentState Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDetachBlockFromAgent = <
  TData = Common.AgentsServiceDetachBlockFromAgentMutationResult,
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
      AgentsService.detachBlockFromAgent({
        agentId,
        blockId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
/**
 * Update Message
 * Update the details of a message associated with an agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.messageId
 * @param data.requestBody
 * @param data.userId
 * @returns letta__schemas__message__Message Successful Response
 * @throws ApiError
 */
export const useAgentsServiceUpdateAgentMessage = <
  TData = Common.AgentsServiceUpdateAgentMessageMutationResult,
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
        requestBody: MessageUpdate;
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
      requestBody: MessageUpdate;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, messageId, requestBody, userId }) =>
      AgentsService.updateAgentMessage({
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
 * Update Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.requestBody
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const useBlocksServiceUpdateMemoryBlock = <
  TData = Common.BlocksServiceUpdateMemoryBlockMutationResult,
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
      BlocksService.updateMemoryBlock({
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
 * Update Provider
 * Update an existing custom provider
 * @param data The data for the request.
 * @param data.requestBody
 * @returns Provider Successful Response
 * @throws ApiError
 */
export const useProvidersServiceUpdateProvider = <
  TData = Common.ProvidersServiceUpdateProviderMutationResult,
  TError = unknown,
  TContext = unknown,
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ProviderUpdate;
      },
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
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      ProvidersService.updateProvider({
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
 * Delete Agent Archival Memory
 * Delete a memory from an agent's archival memory store.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.memoryId
 * @param data.userId
 * @returns unknown Successful Response
 * @throws ApiError
 */
export const useAgentsServiceDeleteAgentArchivalMemory = <
  TData = Common.AgentsServiceDeleteAgentArchivalMemoryMutationResult,
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
      AgentsService.deleteAgentArchivalMemory({
        agentId,
        memoryId,
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
export const useBlocksServiceDeleteMemoryBlock = <
  TData = Common.BlocksServiceDeleteMemoryBlockMutationResult,
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
      BlocksService.deleteMemoryBlock({
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
      },
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
    },
    TContext
  >({
    mutationFn: ({ providerId }) =>
      ProvidersService.deleteProvider({
        providerId,
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

// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { type QueryClient } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
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
import { MessageRole, SandboxType } from '../requests/types.gen';
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
export const prefetchUseToolsServiceGetTool = (
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
    queryKey: Common.UseToolsServiceGetToolKeyFn({ toolId, userId }),
    queryFn: () => ToolsService.getTool({ toolId, userId }),
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
export const prefetchUseToolsServiceListTools = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
    userId,
  }: {
    cursor?: string;
    limit?: number;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListToolsKeyFn({ cursor, limit, userId }),
    queryFn: () => ToolsService.listTools({ cursor, limit, userId }),
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
 * Get Source
 * Get all sources
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
 * @returns Source Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceGetSource = (
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
    queryKey: Common.UseSourcesServiceGetSourceKeyFn({ sourceId, userId }),
    queryFn: () => SourcesService.getSource({ sourceId, userId }),
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
 * List Passages
 * List all passages associated with a data source.
 * @param data The data for the request.
 * @param data.sourceId
 * @param data.userId
 * @returns Passage Successful Response
 * @throws ApiError
 */
export const prefetchUseSourcesServiceListSourcePassages = (
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
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn({
      sourceId,
      userId,
    }),
    queryFn: () => SourcesService.listSourcePassages({ sourceId, userId }),
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
export const prefetchUseSourcesServiceListFilesFromSource = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListFilesFromSourceKeyFn({
      cursor,
      limit,
      sourceId,
      userId,
    }),
    queryFn: () =>
      SourcesService.listFilesFromSource({ cursor, limit, sourceId, userId }),
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
export const prefetchUseAgentsServiceListAgents = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn({
      cursor,
      limit,
      matchAllTags,
      name,
      queryText,
      tags,
      userId,
    }),
    queryFn: () =>
      AgentsService.listAgents({
        cursor,
        limit,
        matchAllTags,
        name,
        queryText,
        tags,
        userId,
      }),
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
export const prefetchUseAgentsServiceGetAgentContextWindow = (
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
    queryKey: Common.UseAgentsServiceGetAgentContextWindowKeyFn({
      agentId,
      userId,
    }),
    queryFn: () => AgentsService.getAgentContextWindow({ agentId, userId }),
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
export const prefetchUseAgentsServiceGetAgent = (
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
    queryKey: Common.UseAgentsServiceGetAgentKeyFn({ agentId, userId }),
    queryFn: () => AgentsService.getAgent({ agentId, userId }),
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
export const prefetchUseAgentsServiceGetToolsFromAgent = (
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
    queryKey: Common.UseAgentsServiceGetToolsFromAgentKeyFn({
      agentId,
      userId,
    }),
    queryFn: () => AgentsService.getToolsFromAgent({ agentId, userId }),
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
export const prefetchUseAgentsServiceGetAgentSources = (
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
    queryKey: Common.UseAgentsServiceGetAgentSourcesKeyFn({ agentId, userId }),
    queryFn: () => AgentsService.getAgentSources({ agentId, userId }),
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
export const prefetchUseAgentsServiceGetAgentMemory = (
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
    queryKey: Common.UseAgentsServiceGetAgentMemoryKeyFn({ agentId, userId }),
    queryFn: () => AgentsService.getAgentMemory({ agentId, userId }),
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
export const prefetchUseAgentsServiceGetAgentMemoryBlock = (
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
    queryKey: Common.UseAgentsServiceGetAgentMemoryBlockKeyFn({
      agentId,
      blockLabel,
      userId,
    }),
    queryFn: () =>
      AgentsService.getAgentMemoryBlock({ agentId, blockLabel, userId }),
  });
/**
 * Get Agent Memory Blocks
 * Retrieve the memory blocks of a specific agent.
 * @param data The data for the request.
 * @param data.agentId
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const prefetchUseAgentsServiceGetAgentMemoryBlocks = (
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
    queryKey: Common.UseAgentsServiceGetAgentMemoryBlocksKeyFn({
      agentId,
      userId,
    }),
    queryFn: () => AgentsService.getAgentMemoryBlocks({ agentId, userId }),
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
export const prefetchUseAgentsServiceListAgentArchivalMemory = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentArchivalMemoryKeyFn({
      after,
      agentId,
      before,
      limit,
      userId,
    }),
    queryFn: () =>
      AgentsService.listAgentArchivalMemory({
        after,
        agentId,
        before,
        limit,
        userId,
      }),
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
export const prefetchUseAgentsServiceListAgentMessages = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentMessagesKeyFn({
      agentId,
      assistantMessageToolKwarg,
      assistantMessageToolName,
      before,
      limit,
      msgObject,
      userId,
    }),
    queryFn: () =>
      AgentsService.listAgentMessages({
        agentId,
        assistantMessageToolKwarg,
        assistantMessageToolName,
        before,
        limit,
        msgObject,
        userId,
      }),
  });
/**
 * List Llm Backends
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const prefetchUseModelsServiceListModels = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListModelsKeyFn(),
    queryFn: () => ModelsService.listModels(),
  });
/**
 * List Embedding Backends
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const prefetchUseModelsServiceListEmbeddingModels = (
  queryClient: QueryClient,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn(),
    queryFn: () => ModelsService.listEmbeddingModels(),
  });
/**
 * List Llm Backends
 * @returns LLMConfig Successful Response
 * @throws ApiError
 */
export const prefetchUseLlmsServiceListModels = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseLlmsServiceListModelsKeyFn(),
    queryFn: () => LlmsService.listModels(),
  });
/**
 * List Embedding Backends
 * @returns EmbeddingConfig Successful Response
 * @throws ApiError
 */
export const prefetchUseLlmsServiceListEmbeddingModels = (
  queryClient: QueryClient,
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn(),
    queryFn: () => LlmsService.listEmbeddingModels(),
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
export const prefetchUseBlocksServiceListMemoryBlocks = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceListMemoryBlocksKeyFn({
      label,
      name,
      templatesOnly,
      userId,
    }),
    queryFn: () =>
      BlocksService.listMemoryBlocks({ label, name, templatesOnly, userId }),
  });
/**
 * Get Block
 * @param data The data for the request.
 * @param data.blockId
 * @param data.userId
 * @returns Block Successful Response
 * @throws ApiError
 */
export const prefetchUseBlocksServiceGetMemoryBlock = (
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
    queryKey: Common.UseBlocksServiceGetMemoryBlockKeyFn({ blockId, userId }),
    queryFn: () => BlocksService.getMemoryBlock({ blockId, userId }),
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
export const prefetchUseJobsServiceListJobs = (
  queryClient: QueryClient,
  {
    sourceId,
    userId,
  }: {
    sourceId?: string;
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListJobsKeyFn({ sourceId, userId }),
    queryFn: () => JobsService.listJobs({ sourceId, userId }),
  });
/**
 * List Active Jobs
 * List all active jobs.
 * @param data The data for the request.
 * @param data.userId
 * @returns Job Successful Response
 * @throws ApiError
 */
export const prefetchUseJobsServiceListActiveJobs = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn({ userId }),
    queryFn: () => JobsService.listActiveJobs({ userId }),
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
export const prefetchUseJobsServiceGetJob = (
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
    queryKey: Common.UseJobsServiceGetJobKeyFn({ jobId, userId }),
    queryFn: () => JobsService.getJob({ jobId, userId }),
  });
/**
 * Health Check
 * @returns Health Successful Response
 * @throws ApiError
 */
export const prefetchUseHealthServiceHealthCheck = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseHealthServiceHealthCheckKeyFn(),
    queryFn: () => HealthService.healthCheck(),
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
export const prefetchUseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGet =
  (
    queryClient: QueryClient,
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
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKeyFn(
          { cursor, limit, sandboxType, userId },
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxConfigsV1SandboxConfigGet({
          cursor,
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
 * @param data.cursor Pagination cursor to fetch the next set of results
 * @param data.userId
 * @returns SandboxEnvironmentVariable Successful Response
 * @throws ApiError
 */
export const prefetchUseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet =
  (
    queryClient: QueryClient,
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
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKeyFn(
          { cursor, limit, sandboxConfigId, userId },
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
          { cursor, limit, sandboxConfigId, userId },
        ),
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
export const prefetchUseProvidersServiceListProviders = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseProvidersServiceListProvidersKeyFn({ cursor, limit }),
    queryFn: () => ProvidersService.listProviders({ cursor, limit }),
  });
/**
 * List Runs
 * List all runs.
 * @param data The data for the request.
 * @param data.userId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceListRuns = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListRunsKeyFn({ userId }),
    queryFn: () => RunsService.listRuns({ userId }),
  });
/**
 * List Active Runs
 * List all active runs.
 * @param data The data for the request.
 * @param data.userId
 * @returns Run Successful Response
 * @throws ApiError
 */
export const prefetchUseRunsServiceListActiveRuns = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceListActiveRunsKeyFn({ userId }),
    queryFn: () => RunsService.listActiveRuns({ userId }),
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
export const prefetchUseRunsServiceGetRun = (
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
    queryKey: Common.UseRunsServiceGetRunKeyFn({ runId, userId }),
    queryFn: () => RunsService.getRun({ runId, userId }),
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
export const prefetchUseRunsServiceGetRunMessages = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseRunsServiceGetRunMessagesKeyFn({
      ascending,
      cursor,
      limit,
      role,
      runId,
      userId,
    }),
    queryFn: () =>
      RunsService.getRunMessages({
        ascending,
        cursor,
        limit,
        role,
        runId,
        userId,
      }),
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
export const prefetchUseRunsServiceGetRunUsage = (
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
    queryKey: Common.UseRunsServiceGetRunUsageKeyFn({ runId, userId }),
    queryFn: () => RunsService.getRunUsage({ runId, userId }),
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
export const prefetchUseTagServiceListTags = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseTagServiceListTagsKeyFn({
      cursor,
      limit,
      queryText,
      userId,
    }),
    queryFn: () => TagService.listTags({ cursor, limit, queryText, userId }),
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
export const prefetchUseAdminServiceListTags = (
  queryClient: QueryClient,
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
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListTagsKeyFn({
      cursor,
      limit,
      queryText,
      userId,
    }),
    queryFn: () => AdminService.listTags({ cursor, limit, queryText, userId }),
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
export const prefetchUseAdminServiceListUsers = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListUsersKeyFn({ cursor, limit }),
    queryFn: () => AdminService.listUsers({ cursor, limit }),
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
export const prefetchUseAdminServiceListOrgs = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListOrgsKeyFn({ cursor, limit }),
    queryFn: () => AdminService.listOrgs({ cursor, limit }),
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
export const prefetchUseUsersServiceListUsers = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseUsersServiceListUsersKeyFn({ cursor, limit }),
    queryFn: () => UsersService.listUsers({ cursor, limit }),
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
export const prefetchUseOrganizationServiceListOrgs = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseOrganizationServiceListOrgsKeyFn({ cursor, limit }),
    queryFn: () => OrganizationService.listOrgs({ cursor, limit }),
  });

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
  JobsService,
  LlmsService,
  ModelsService,
  OrganizationService,
  SandboxConfigService,
  SourcesService,
  ToolsService,
  UsersService,
} from '../requests/services.gen';
import {
  APIKeyCreate,
  AuthRequest,
  BlockUpdate,
  Body_upload_file_to_source,
  CreateAgent,
  CreateArchivalMemory,
  CreateBlock,
  LettaRequest,
  LettaStreamingRequest,
  OrganizationCreate,
  SandboxConfigCreate,
  SandboxConfigUpdate,
  SandboxEnvironmentVariableCreate,
  SandboxEnvironmentVariableUpdate,
  SourceCreate,
  SourceUpdate,
  ToolCreate,
  ToolRunFromSource,
  ToolUpdate,
  UpdateAgentState,
  UpdateMessage,
  UserCreate,
  UserUpdate,
} from '../requests/types.gen';
import * as Common from './common';
export const useToolsServiceGetTool = <
  TData = Common.ToolsServiceGetToolDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    toolId,
    userId,
  }: {
    toolId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolKeyFn({ toolId, userId }, queryKey),
    queryFn: () => ToolsService.getTool({ toolId, userId }) as TData,
    ...options,
  });
export const useToolsServiceGetToolIdByName = <
  TData = Common.ToolsServiceGetToolIdByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    toolName,
    userId,
  }: {
    toolName: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolIdByNameKeyFn(
      { toolName, userId },
      queryKey
    ),
    queryFn: () => ToolsService.getToolIdByName({ toolName, userId }) as TData,
    ...options,
  });
export const useToolsServiceListTools = <
  TData = Common.ToolsServiceListToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
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
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListToolsKeyFn(
      { cursor, limit, userId },
      queryKey
    ),
    queryFn: () => ToolsService.listTools({ cursor, limit, userId }) as TData,
    ...options,
  });
export const useToolsServiceListComposioApps = <
  TData = Common.ToolsServiceListComposioAppsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioAppsKeyFn({ userId }, queryKey),
    queryFn: () => ToolsService.listComposioApps({ userId }) as TData,
    ...options,
  });
export const useToolsServiceListComposioActionsByApp = <
  TData = Common.ToolsServiceListComposioActionsByAppDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    composioAppName,
    userId,
  }: {
    composioAppName: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioActionsByAppKeyFn(
      { composioAppName, userId },
      queryKey
    ),
    queryFn: () =>
      ToolsService.listComposioActionsByApp({
        composioAppName,
        userId,
      }) as TData,
    ...options,
  });
export const useSourcesServiceGetSource = <
  TData = Common.SourcesServiceGetSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceKeyFn(
      { sourceId, userId },
      queryKey
    ),
    queryFn: () => SourcesService.getSource({ sourceId, userId }) as TData,
    ...options,
  });
export const useSourcesServiceGetSourceIdByName = <
  TData = Common.SourcesServiceGetSourceIdByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceName,
    userId,
  }: {
    sourceName: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn(
      { sourceName, userId },
      queryKey
    ),
    queryFn: () =>
      SourcesService.getSourceIdByName({ sourceName, userId }) as TData,
    ...options,
  });
export const useSourcesServiceListSources = <
  TData = Common.SourcesServiceListSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn({ userId }, queryKey),
    queryFn: () => SourcesService.listSources({ userId }) as TData,
    ...options,
  });
export const useSourcesServiceListSourcePassages = <
  TData = Common.SourcesServiceListSourcePassagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn(
      { sourceId, userId },
      queryKey
    ),
    queryFn: () =>
      SourcesService.listSourcePassages({ sourceId, userId }) as TData,
    ...options,
  });
export const useSourcesServiceListFilesFromSource = <
  TData = Common.SourcesServiceListFilesFromSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
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
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListFilesFromSourceKeyFn(
      { cursor, limit, sourceId, userId },
      queryKey
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
export const useAgentsServiceListAgents = <
  TData = Common.AgentsServiceListAgentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    name,
    tags,
    userId,
  }: {
    name?: string;
    tags?: string[];
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn(
      { name, tags, userId },
      queryKey
    ),
    queryFn: () => AgentsService.listAgents({ name, tags, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentContextWindow = <
  TData = Common.AgentsServiceGetAgentContextWindowDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentContextWindowKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentContextWindow({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgent = <
  TData = Common.AgentsServiceGetAgentDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () => AgentsService.getAgent({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetToolsFromAgent = <
  TData = Common.AgentsServiceGetToolsFromAgentDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetToolsFromAgentKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getToolsFromAgent({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentSources = <
  TData = Common.AgentsServiceGetAgentSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentSourcesKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () => AgentsService.getAgentSources({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceListAgentInContextMessages = <
  TData = Common.AgentsServiceListAgentInContextMessagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentInContextMessagesKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.listAgentInContextMessages({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentMemory = <
  TData = Common.AgentsServiceGetAgentMemoryDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentMemoryKeyFn({ agentId }, queryKey),
    queryFn: () => AgentsService.getAgentMemory({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentMemoryBlock = <
  TData = Common.AgentsServiceGetAgentMemoryBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
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
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentMemoryBlockKeyFn(
      { agentId, blockLabel, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentMemoryBlock({
        agentId,
        blockLabel,
        userId,
      }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentMemoryBlocks = <
  TData = Common.AgentsServiceGetAgentMemoryBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentMemoryBlocksKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentMemoryBlocks({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentRecallMemorySummary = <
  TData = Common.AgentsServiceGetAgentRecallMemorySummaryDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentRecallMemorySummaryKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentRecallMemorySummary({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentArchivalMemorySummary = <
  TData = Common.AgentsServiceGetAgentArchivalMemorySummaryDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentArchivalMemorySummaryKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentArchivalMemorySummary({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceListAgentArchivalMemory = <
  TData = Common.AgentsServiceListAgentArchivalMemoryDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
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
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentArchivalMemoryKeyFn(
      { after, agentId, before, limit, userId },
      queryKey
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
export const useAgentsServiceListAgentMessages = <
  TData = Common.AgentsServiceListAgentMessagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
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
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
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
      queryKey
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
export const useModelsServiceListModels = <
  TData = Common.ModelsServiceListModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListModelsKeyFn(queryKey),
    queryFn: () => ModelsService.listModels() as TData,
    ...options,
  });
export const useModelsServiceListEmbeddingModels = <
  TData = Common.ModelsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn(queryKey),
    queryFn: () => ModelsService.listEmbeddingModels() as TData,
    ...options,
  });
export const useLlmsServiceListModels = <
  TData = Common.LlmsServiceListModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListModelsKeyFn(queryKey),
    queryFn: () => LlmsService.listModels() as TData,
    ...options,
  });
export const useLlmsServiceListEmbeddingModels = <
  TData = Common.LlmsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn(queryKey),
    queryFn: () => LlmsService.listEmbeddingModels() as TData,
    ...options,
  });
export const useBlocksServiceListMemoryBlocks = <
  TData = Common.BlocksServiceListMemoryBlocksDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
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
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceListMemoryBlocksKeyFn(
      { label, name, templatesOnly, userId },
      queryKey
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
export const useBlocksServiceGetMemoryBlock = <
  TData = Common.BlocksServiceGetMemoryBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    blockId,
    userId,
  }: {
    blockId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceGetMemoryBlockKeyFn(
      { blockId, userId },
      queryKey
    ),
    queryFn: () => BlocksService.getMemoryBlock({ blockId, userId }) as TData,
    ...options,
  });
export const useJobsServiceListJobs = <
  TData = Common.JobsServiceListJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceId,
    userId,
  }: {
    sourceId?: string;
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsKeyFn(
      { sourceId, userId },
      queryKey
    ),
    queryFn: () => JobsService.listJobs({ sourceId, userId }) as TData,
    ...options,
  });
export const useJobsServiceListActiveJobs = <
  TData = Common.JobsServiceListActiveJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    userId,
  }: {
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn({ userId }, queryKey),
    queryFn: () => JobsService.listActiveJobs({ userId }) as TData,
    ...options,
  });
export const useJobsServiceGetJob = <
  TData = Common.JobsServiceGetJobDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    jobId,
    userId,
  }: {
    jobId: string;
    userId?: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceGetJobKeyFn({ jobId, userId }, queryKey),
    queryFn: () => JobsService.getJob({ jobId, userId }) as TData,
    ...options,
  });
export const useHealthServiceHealthCheck = <
  TData = Common.HealthServiceHealthCheckDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseHealthServiceHealthCheckKeyFn(queryKey),
    queryFn: () => HealthService.healthCheck() as TData,
    ...options,
  });
export const useSandboxConfigServiceListSandboxConfigsV1SandboxConfigGet = <
  TData = Common.SandboxConfigServiceListSandboxConfigsV1SandboxConfigGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
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
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey:
      Common.UseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKeyFn(
        { cursor, limit, userId },
        queryKey
      ),
    queryFn: () =>
      SandboxConfigService.listSandboxConfigsV1SandboxConfigGet({
        cursor,
        limit,
        userId,
      }) as TData,
    ...options,
  });
export const useSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet =
  <
    TData = Common.SandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetDefaultResponse,
    TError = unknown,
    TQueryKey extends Array<unknown> = unknown[]
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
    options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
  ) =>
    useQuery<TData, TError>({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKeyFn(
          { cursor, limit, sandboxConfigId, userId },
          queryKey
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
          { cursor, limit, sandboxConfigId, userId }
        ) as TData,
      ...options,
    });
export const useUsersServiceListUsers = <
  TData = Common.UsersServiceListUsersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseUsersServiceListUsersKeyFn({ cursor, limit }, queryKey),
    queryFn: () => UsersService.listUsers({ cursor, limit }) as TData,
    ...options,
  });
export const useUsersServiceListApiKeys = <
  TData = Common.UsersServiceListApiKeysDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    userId,
  }: {
    userId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseUsersServiceListApiKeysKeyFn({ userId }, queryKey),
    queryFn: () => UsersService.listApiKeys({ userId }) as TData,
    ...options,
  });
export const useAdminServiceListUsers = <
  TData = Common.AdminServiceListUsersDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListUsersKeyFn({ cursor, limit }, queryKey),
    queryFn: () => AdminService.listUsers({ cursor, limit }) as TData,
    ...options,
  });
export const useAdminServiceListApiKeys = <
  TData = Common.AdminServiceListApiKeysDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    userId,
  }: {
    userId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListApiKeysKeyFn({ userId }, queryKey),
    queryFn: () => AdminService.listApiKeys({ userId }) as TData,
    ...options,
  });
export const useAdminServiceListOrgs = <
  TData = Common.AdminServiceListOrgsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListOrgsKeyFn({ cursor, limit }, queryKey),
    queryFn: () => AdminService.listOrgs({ cursor, limit }) as TData,
    ...options,
  });
export const useOrganizationServiceListOrgs = <
  TData = Common.OrganizationServiceListOrgsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseOrganizationServiceListOrgsKeyFn(
      { cursor, limit },
      queryKey
    ),
    queryFn: () => OrganizationService.listOrgs({ cursor, limit }) as TData,
    ...options,
  });
export const useToolsServiceCreateTool = <
  TData = Common.ToolsServiceCreateToolMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useToolsServiceAddBaseTools = <
  TData = Common.ToolsServiceAddBaseToolsMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useToolsServiceRunToolFromSource = <
  TData = Common.ToolsServiceRunToolFromSourceMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useToolsServiceAddComposioTool = <
  TData = Common.ToolsServiceAddComposioToolMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useSourcesServiceCreateSource = <
  TData = Common.SourcesServiceCreateSourceMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useSourcesServiceAttachAgentToSource = <
  TData = Common.SourcesServiceAttachAgentToSourceMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
      SourcesService.attachAgentToSource({
        agentId,
        sourceId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useSourcesServiceDetachAgentFromSource = <
  TData = Common.SourcesServiceDetachAgentFromSourceMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
      SourcesService.detachAgentFromSource({
        agentId,
        sourceId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useSourcesServiceUploadFileToSource = <
  TData = Common.SourcesServiceUploadFileToSourceMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAgentsServiceCreateAgent = <
  TData = Common.AgentsServiceCreateAgentMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CreateAgent;
        userId?: string;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: CreateAgent;
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
export const useAgentsServiceAddAgentMemoryBlock = <
  TData = Common.AgentsServiceAddAgentMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: CreateBlock;
        userId?: string;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: CreateBlock;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody, userId }) =>
      AgentsService.addAgentMemoryBlock({
        agentId,
        requestBody,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceCreateAgentArchivalMemory = <
  TData = Common.AgentsServiceCreateAgentArchivalMemoryMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAgentsServiceCreateAgentMessage = <
  TData = Common.AgentsServiceCreateAgentMessageMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAgentsServiceCreateAgentMessageStream = <
  TData = Common.AgentsServiceCreateAgentMessageStreamMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useBlocksServiceCreateMemoryBlock = <
  TData = Common.BlocksServiceCreateMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useSandboxConfigServiceCreateSandboxConfigV1SandboxConfigPost = <
  TData = Common.SandboxConfigServiceCreateSandboxConfigV1SandboxConfigPostMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useSandboxConfigServiceCreateDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPost =
  <
    TData = Common.SandboxConfigServiceCreateDefaultE2bSandboxConfigV1SandboxConfigE2bDefaultPostMutationResult,
    TError = unknown,
    TContext = unknown
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
    >
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
          { userId }
        ) as unknown as Promise<TData>,
      ...options,
    });
export const useSandboxConfigServiceCreateDefaultLocalSandboxConfigV1SandboxConfigLocalDefaultPost =
  <
    TData = Common.SandboxConfigServiceCreateDefaultLocalSandboxConfigV1SandboxConfigLocalDefaultPostMutationResult,
    TError = unknown,
    TContext = unknown
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
    >
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
          { userId }
        ) as unknown as Promise<TData>,
      ...options,
    });
export const useSandboxConfigServiceCreateSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePost =
  <
    TData = Common.SandboxConfigServiceCreateSandboxEnvVarV1SandboxConfigSandboxConfigIdEnvironmentVariablePostMutationResult,
    TError = unknown,
    TContext = unknown
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
    >
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
          { requestBody, sandboxConfigId, userId }
        ) as unknown as Promise<TData>,
      ...options,
    });
export const useUsersServiceCreateUser = <
  TData = Common.UsersServiceCreateUserMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useUsersServiceCreateApiKey = <
  TData = Common.UsersServiceCreateApiKeyMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: APIKeyCreate;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: APIKeyCreate;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      UsersService.createApiKey({ requestBody }) as unknown as Promise<TData>,
    ...options,
  });
export const useAdminServiceCreateUser = <
  TData = Common.AdminServiceCreateUserMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAdminServiceCreateApiKey = <
  TData = Common.AdminServiceCreateApiKeyMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: APIKeyCreate;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      requestBody: APIKeyCreate;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      AdminService.createApiKey({ requestBody }) as unknown as Promise<TData>,
    ...options,
  });
export const useAdminServiceCreateOrganization = <
  TData = Common.AdminServiceCreateOrganizationMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useOrganizationServiceCreateOrganization = <
  TData = Common.OrganizationServiceCreateOrganizationMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAuthServiceAuthenticateUserV1AuthPost = <
  TData = Common.AuthServiceAuthenticateUserV1AuthPostMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useToolsServiceUpsertTool = <
  TData = Common.ToolsServiceUpsertToolMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useUsersServiceUpdateUser = <
  TData = Common.UsersServiceUpdateUserMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAdminServiceUpdateUser = <
  TData = Common.AdminServiceUpdateUserMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useToolsServiceUpdateTool = <
  TData = Common.ToolsServiceUpdateToolMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useSourcesServiceUpdateSource = <
  TData = Common.SourcesServiceUpdateSourceMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAgentsServiceUpdateAgent = <
  TData = Common.AgentsServiceUpdateAgentMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: UpdateAgentState;
        userId?: string;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      requestBody: UpdateAgentState;
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
export const useAgentsServiceAddToolToAgent = <
  TData = Common.AgentsServiceAddToolToAgentMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
      AgentsService.addToolToAgent({
        agentId,
        toolId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceRemoveToolFromAgent = <
  TData = Common.AgentsServiceRemoveToolFromAgentMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
      AgentsService.removeToolFromAgent({
        agentId,
        toolId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceUpdateAgentMemoryBlockByLabel = <
  TData = Common.AgentsServiceUpdateAgentMemoryBlockByLabelMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAgentsServiceUpdateAgentMessage = <
  TData = Common.AgentsServiceUpdateAgentMessageMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        messageId: string;
        requestBody: UpdateMessage;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      messageId: string;
      requestBody: UpdateMessage;
    },
    TContext
  >({
    mutationFn: ({ agentId, messageId, requestBody }) =>
      AgentsService.updateAgentMessage({
        agentId,
        messageId,
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useBlocksServiceUpdateMemoryBlock = <
  TData = Common.BlocksServiceUpdateMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useBlocksServiceLinkAgentMemoryBlock = <
  TData = Common.BlocksServiceLinkAgentMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
      BlocksService.linkAgentMemoryBlock({
        agentId,
        blockId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useBlocksServiceUnlinkAgentMemoryBlock = <
  TData = Common.BlocksServiceUnlinkAgentMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
      BlocksService.unlinkAgentMemoryBlock({
        agentId,
        blockId,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useSandboxConfigServiceUpdateSandboxConfigV1SandboxConfigSandboxConfigIdPatch =
  <
    TData = Common.SandboxConfigServiceUpdateSandboxConfigV1SandboxConfigSandboxConfigIdPatchMutationResult,
    TError = unknown,
    TContext = unknown
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
    >
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
          { requestBody, sandboxConfigId, userId }
        ) as unknown as Promise<TData>,
      ...options,
    });
export const useSandboxConfigServiceUpdateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatch =
  <
    TData = Common.SandboxConfigServiceUpdateSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdPatchMutationResult,
    TError = unknown,
    TContext = unknown
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
    >
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
          { envVarId, requestBody, userId }
        ) as unknown as Promise<TData>,
      ...options,
    });
export const useToolsServiceDeleteTool = <
  TData = Common.ToolsServiceDeleteToolMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useSourcesServiceDeleteSource = <
  TData = Common.SourcesServiceDeleteSourceMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useSourcesServiceDeleteFileFromSource = <
  TData = Common.SourcesServiceDeleteFileFromSourceMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAgentsServiceDeleteAgent = <
  TData = Common.AgentsServiceDeleteAgentMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAgentsServiceRemoveAgentMemoryBlockByLabel = <
  TData = Common.AgentsServiceRemoveAgentMemoryBlockByLabelMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        blockLabel: string;
        userId?: string;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      agentId: string;
      blockLabel: string;
      userId?: string;
    },
    TContext
  >({
    mutationFn: ({ agentId, blockLabel, userId }) =>
      AgentsService.removeAgentMemoryBlockByLabel({
        agentId,
        blockLabel,
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceDeleteAgentArchivalMemory = <
  TData = Common.AgentsServiceDeleteAgentArchivalMemoryMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useBlocksServiceDeleteMemoryBlock = <
  TData = Common.BlocksServiceDeleteMemoryBlockMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useJobsServiceDeleteJob = <
  TData = Common.JobsServiceDeleteJobMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useSandboxConfigServiceDeleteSandboxConfigV1SandboxConfigSandboxConfigIdDelete =
  <
    TData = Common.SandboxConfigServiceDeleteSandboxConfigV1SandboxConfigSandboxConfigIdDeleteMutationResult,
    TError = unknown,
    TContext = unknown
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
    >
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
          { sandboxConfigId, userId }
        ) as unknown as Promise<TData>,
      ...options,
    });
export const useSandboxConfigServiceDeleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDelete =
  <
    TData = Common.SandboxConfigServiceDeleteSandboxEnvVarV1SandboxConfigEnvironmentVariableEnvVarIdDeleteMutationResult,
    TError = unknown,
    TContext = unknown
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
    >
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
          { envVarId, userId }
        ) as unknown as Promise<TData>,
      ...options,
    });
export const useUsersServiceDeleteUser = <
  TData = Common.UsersServiceDeleteUserMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useUsersServiceDeleteApiKey = <
  TData = Common.UsersServiceDeleteApiKeyMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        apiKey: string;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      apiKey: string;
    },
    TContext
  >({
    mutationFn: ({ apiKey }) =>
      UsersService.deleteApiKey({ apiKey }) as unknown as Promise<TData>,
    ...options,
  });
export const useAdminServiceDeleteUser = <
  TData = Common.AdminServiceDeleteUserMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useAdminServiceDeleteApiKey = <
  TData = Common.AdminServiceDeleteApiKeyMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        apiKey: string;
      },
      TContext
    >,
    'mutationFn'
  >
) =>
  useMutation<
    TData,
    TError,
    {
      apiKey: string;
    },
    TContext
  >({
    mutationFn: ({ apiKey }) =>
      AdminService.deleteApiKey({ apiKey }) as unknown as Promise<TData>,
    ...options,
  });
export const useAdminServiceDeleteOrganizationById = <
  TData = Common.AdminServiceDeleteOrganizationByIdMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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
export const useOrganizationServiceDeleteOrganizationById = <
  TData = Common.OrganizationServiceDeleteOrganizationByIdMutationResult,
  TError = unknown,
  TContext = unknown
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
  >
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

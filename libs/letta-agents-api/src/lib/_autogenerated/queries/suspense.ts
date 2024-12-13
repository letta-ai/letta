// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryOptions, useSuspenseQuery } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
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
import * as Common from './common';
export const useToolsServiceGetToolSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolKeyFn({ toolId, userId }, queryKey),
    queryFn: () => ToolsService.getTool({ toolId, userId }) as TData,
    ...options,
  });
export const useToolsServiceGetToolIdByNameSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolIdByNameKeyFn(
      { toolName, userId },
      queryKey
    ),
    queryFn: () => ToolsService.getToolIdByName({ toolName, userId }) as TData,
    ...options,
  });
export const useToolsServiceListToolsSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListToolsKeyFn(
      { cursor, limit, userId },
      queryKey
    ),
    queryFn: () => ToolsService.listTools({ cursor, limit, userId }) as TData,
    ...options,
  });
export const useToolsServiceListComposioAppsSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListComposioAppsKeyFn({ userId }, queryKey),
    queryFn: () => ToolsService.listComposioApps({ userId }) as TData,
    ...options,
  });
export const useToolsServiceListComposioActionsByAppSuspense = <
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
  useSuspenseQuery<TData, TError>({
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
export const useSourcesServiceGetSourceSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceKeyFn(
      { sourceId, userId },
      queryKey
    ),
    queryFn: () => SourcesService.getSource({ sourceId, userId }) as TData,
    ...options,
  });
export const useSourcesServiceGetSourceIdByNameSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn(
      { sourceName, userId },
      queryKey
    ),
    queryFn: () =>
      SourcesService.getSourceIdByName({ sourceName, userId }) as TData,
    ...options,
  });
export const useSourcesServiceListSourcesSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn({ userId }, queryKey),
    queryFn: () => SourcesService.listSources({ userId }) as TData,
    ...options,
  });
export const useSourcesServiceListSourcePassagesSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn(
      { sourceId, userId },
      queryKey
    ),
    queryFn: () =>
      SourcesService.listSourcePassages({ sourceId, userId }) as TData,
    ...options,
  });
export const useSourcesServiceListFilesFromSourceSuspense = <
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
  useSuspenseQuery<TData, TError>({
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
export const useAgentsServiceListAgentsSuspense = <
  TData = Common.AgentsServiceListAgentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    matchAllTags,
    name,
    tags,
    userId,
  }: {
    matchAllTags?: boolean;
    name?: string;
    tags?: string[];
    userId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn(
      { matchAllTags, name, tags, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.listAgents({ matchAllTags, name, tags, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentContextWindowSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentContextWindowKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentContextWindow({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () => AgentsService.getAgent({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetToolsFromAgentSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetToolsFromAgentKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getToolsFromAgent({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentSourcesSuspense = <
  TData = Common.AgentsServiceGetAgentSourcesDefaultResponse,
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentSourcesKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () => AgentsService.getAgentSources({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceListAgentInContextMessagesSuspense = <
  TData = Common.AgentsServiceListAgentInContextMessagesDefaultResponse,
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentInContextMessagesKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.listAgentInContextMessages({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentMemorySuspense = <
  TData = Common.AgentsServiceGetAgentMemoryDefaultResponse,
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentMemoryKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () => AgentsService.getAgentMemory({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentMemoryBlockSuspense = <
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
  useSuspenseQuery<TData, TError>({
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
export const useAgentsServiceGetAgentMemoryBlocksSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentMemoryBlocksKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentMemoryBlocks({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentRecallMemorySummarySuspense = <
  TData = Common.AgentsServiceGetAgentRecallMemorySummaryDefaultResponse,
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentRecallMemorySummaryKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentRecallMemorySummary({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentArchivalMemorySummarySuspense = <
  TData = Common.AgentsServiceGetAgentArchivalMemorySummaryDefaultResponse,
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentArchivalMemorySummaryKeyFn(
      { agentId, userId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentArchivalMemorySummary({ agentId, userId }) as TData,
    ...options,
  });
export const useAgentsServiceListAgentArchivalMemorySuspense = <
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
  useSuspenseQuery<TData, TError>({
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
export const useAgentsServiceListAgentMessagesSuspense = <
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
  useSuspenseQuery<TData, TError>({
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
export const useModelsServiceListModelsSuspense = <
  TData = Common.ModelsServiceListModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListModelsKeyFn(queryKey),
    queryFn: () => ModelsService.listModels() as TData,
    ...options,
  });
export const useModelsServiceListEmbeddingModelsSuspense = <
  TData = Common.ModelsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn(queryKey),
    queryFn: () => ModelsService.listEmbeddingModels() as TData,
    ...options,
  });
export const useLlmsServiceListModelsSuspense = <
  TData = Common.LlmsServiceListModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListModelsKeyFn(queryKey),
    queryFn: () => LlmsService.listModels() as TData,
    ...options,
  });
export const useLlmsServiceListEmbeddingModelsSuspense = <
  TData = Common.LlmsServiceListEmbeddingModelsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn(queryKey),
    queryFn: () => LlmsService.listEmbeddingModels() as TData,
    ...options,
  });
export const useBlocksServiceListMemoryBlocksSuspense = <
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
  useSuspenseQuery<TData, TError>({
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
export const useBlocksServiceGetMemoryBlockSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceGetMemoryBlockKeyFn(
      { blockId, userId },
      queryKey
    ),
    queryFn: () => BlocksService.getMemoryBlock({ blockId, userId }) as TData,
    ...options,
  });
export const useJobsServiceListJobsSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsKeyFn(
      { sourceId, userId },
      queryKey
    ),
    queryFn: () => JobsService.listJobs({ sourceId, userId }) as TData,
    ...options,
  });
export const useJobsServiceListActiveJobsSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn({ userId }, queryKey),
    queryFn: () => JobsService.listActiveJobs({ userId }) as TData,
    ...options,
  });
export const useJobsServiceGetJobSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceGetJobKeyFn({ jobId, userId }, queryKey),
    queryFn: () => JobsService.getJob({ jobId, userId }) as TData,
    ...options,
  });
export const useHealthServiceHealthCheckSuspense = <
  TData = Common.HealthServiceHealthCheckDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseHealthServiceHealthCheckKeyFn(queryKey),
    queryFn: () => HealthService.healthCheck() as TData,
    ...options,
  });
export const useSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetSuspense =
  <
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
    useSuspenseQuery<TData, TError>({
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
export const useSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetSuspense =
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
    useSuspenseQuery<TData, TError>({
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
export const useUsersServiceListUsersSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseUsersServiceListUsersKeyFn({ cursor, limit }, queryKey),
    queryFn: () => UsersService.listUsers({ cursor, limit }) as TData,
    ...options,
  });
export const useUsersServiceListApiKeysSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseUsersServiceListApiKeysKeyFn({ userId }, queryKey),
    queryFn: () => UsersService.listApiKeys({ userId }) as TData,
    ...options,
  });
export const useAdminServiceListUsersSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListUsersKeyFn({ cursor, limit }, queryKey),
    queryFn: () => AdminService.listUsers({ cursor, limit }) as TData,
    ...options,
  });
export const useAdminServiceListApiKeysSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListApiKeysKeyFn({ userId }, queryKey),
    queryFn: () => AdminService.listApiKeys({ userId }) as TData,
    ...options,
  });
export const useAdminServiceListOrgsSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAdminServiceListOrgsKeyFn({ cursor, limit }, queryKey),
    queryFn: () => AdminService.listOrgs({ cursor, limit }) as TData,
    ...options,
  });
export const useOrganizationServiceListOrgsSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseOrganizationServiceListOrgsKeyFn(
      { cursor, limit },
      queryKey
    ),
    queryFn: () => OrganizationService.listOrgs({ cursor, limit }) as TData,
    ...options,
  });

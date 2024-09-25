// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryOptions, useSuspenseQuery } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
  BlocksService,
  JobsService,
  LlmsService,
  ModelsService,
  OrganizationService,
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
  }: {
    toolId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolKeyFn({ toolId }, queryKey),
    queryFn: () => ToolsService.getTool({ toolId }) as TData,
    ...options,
  });
export const useToolsServiceGetToolIdByNameSuspense = <
  TData = Common.ToolsServiceGetToolIdByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    toolName,
  }: {
    toolName: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolIdByNameKeyFn(
      { toolName },
      queryKey
    ),
    queryFn: () => ToolsService.getToolIdByName({ toolName }) as TData,
    ...options,
  });
export const useToolsServiceListToolsSuspense = <
  TData = Common.ToolsServiceListToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListToolsKeyFn(queryKey),
    queryFn: () => ToolsService.listTools() as TData,
    ...options,
  });
export const useSourcesServiceGetSourceSuspense = <
  TData = Common.SourcesServiceGetSourceDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceId,
  }: {
    sourceId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceKeyFn({ sourceId }, queryKey),
    queryFn: () => SourcesService.getSource({ sourceId }) as TData,
    ...options,
  });
export const useSourcesServiceGetSourceIdByNameSuspense = <
  TData = Common.SourcesServiceGetSourceIdByNameDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceName,
  }: {
    sourceName: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn(
      { sourceName },
      queryKey
    ),
    queryFn: () => SourcesService.getSourceIdByName({ sourceName }) as TData,
    ...options,
  });
export const useSourcesServiceListSourcesSuspense = <
  TData = Common.SourcesServiceListSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn(queryKey),
    queryFn: () => SourcesService.listSources() as TData,
    ...options,
  });
export const useSourcesServiceListSourcePassagesSuspense = <
  TData = Common.SourcesServiceListSourcePassagesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceId,
  }: {
    sourceId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn(
      { sourceId },
      queryKey
    ),
    queryFn: () => SourcesService.listSourcePassages({ sourceId }) as TData,
    ...options,
  });
export const useSourcesServiceListSourceDocumentsSuspense = <
  TData = Common.SourcesServiceListSourceDocumentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceId,
  }: {
    sourceId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourceDocumentsKeyFn(
      { sourceId },
      queryKey
    ),
    queryFn: () => SourcesService.listSourceDocuments({ sourceId }) as TData,
    ...options,
  });
export const useAgentsServiceListAgentsSuspense = <
  TData = Common.AgentsServiceListAgentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn(queryKey),
    queryFn: () => AgentsService.listAgents() as TData,
    ...options,
  });
export const useAgentsServiceGetAgentSuspense = <
  TData = Common.AgentsServiceGetAgentDefaultResponse,
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentKeyFn({ agentId }, queryKey),
    queryFn: () => AgentsService.getAgent({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentSourcesSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentSourcesKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () => AgentsService.getAgentSources({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceListAgentInContextMessagesSuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentInContextMessagesKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.listAgentInContextMessages({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentMemorySuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentMemoryKeyFn({ agentId }, queryKey),
    queryFn: () => AgentsService.getAgentMemory({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentRecallMemorySummarySuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentRecallMemorySummaryKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentRecallMemorySummary({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentArchivalMemorySummarySuspense = <
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
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentArchivalMemorySummaryKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentArchivalMemorySummary({ agentId }) as TData,
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
  }: {
    after?: number;
    agentId: string;
    before?: number;
    limit?: number;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentArchivalMemoryKeyFn(
      { after, agentId, before, limit },
      queryKey
    ),
    queryFn: () =>
      AgentsService.listAgentArchivalMemory({
        after,
        agentId,
        before,
        limit,
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
    before,
    limit,
    msgObject,
  }: {
    agentId: string;
    before?: string;
    limit?: number;
    msgObject?: boolean;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentMessagesKeyFn(
      { agentId, before, limit, msgObject },
      queryKey
    ),
    queryFn: () =>
      AgentsService.listAgentMessages({
        agentId,
        before,
        limit,
        msgObject,
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
  }: {
    label?: string;
    name?: string;
    templatesOnly?: boolean;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceListMemoryBlocksKeyFn(
      { label, name, templatesOnly },
      queryKey
    ),
    queryFn: () =>
      BlocksService.listMemoryBlocks({ label, name, templatesOnly }) as TData,
    ...options,
  });
export const useBlocksServiceGetMemoryBlockSuspense = <
  TData = Common.BlocksServiceGetMemoryBlockDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    blockId,
  }: {
    blockId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceGetMemoryBlockKeyFn({ blockId }, queryKey),
    queryFn: () => BlocksService.getMemoryBlock({ blockId }) as TData,
    ...options,
  });
export const useJobsServiceListJobsSuspense = <
  TData = Common.JobsServiceListJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    sourceId,
  }: {
    sourceId?: string;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsKeyFn({ sourceId }, queryKey),
    queryFn: () => JobsService.listJobs({ sourceId }) as TData,
    ...options,
  });
export const useJobsServiceListActiveJobsSuspense = <
  TData = Common.JobsServiceListActiveJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn(queryKey),
    queryFn: () => JobsService.listActiveJobs() as TData,
    ...options,
  });
export const useJobsServiceGetJobSuspense = <
  TData = Common.JobsServiceGetJobDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  {
    jobId,
  }: {
    jobId: string;
  },
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceGetJobKeyFn({ jobId }, queryKey),
    queryFn: () => JobsService.getJob({ jobId }) as TData,
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

// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryOptions, useSuspenseQuery } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
  BlockService,
  ConfigService,
  JobsService,
  ModelsService,
  SourcesService,
  ToolsService,
} from '../requests/services.gen';
import * as Common from './common';
export const useAdminServiceGetAllUsersAdminUsersGetSuspense = <
  TData = Common.AdminServiceGetAllUsersAdminUsersGetDefaultResponse,
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
    queryKey: Common.UseAdminServiceGetAllUsersAdminUsersGetKeyFn(
      { cursor, limit },
      queryKey
    ),
    queryFn: () =>
      AdminService.getAllUsersAdminUsersGet({ cursor, limit }) as TData,
    ...options,
  });
export const useAdminServiceGetApiKeysAdminUsersKeysGetSuspense = <
  TData = Common.AdminServiceGetApiKeysAdminUsersKeysGetDefaultResponse,
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
    queryKey: Common.UseAdminServiceGetApiKeysAdminUsersKeysGetKeyFn(
      { userId },
      queryKey
    ),
    queryFn: () =>
      AdminService.getApiKeysAdminUsersKeysGet({ userId }) as TData,
    ...options,
  });
export const useToolsServiceGetToolAdminToolsToolNameGetSuspense = <
  TData = Common.ToolsServiceGetToolAdminToolsToolNameGetDefaultResponse,
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
    queryKey: Common.UseToolsServiceGetToolAdminToolsToolNameGetKeyFn(
      { toolName },
      queryKey
    ),
    queryFn: () =>
      ToolsService.getToolAdminToolsToolNameGet({ toolName }) as TData,
    ...options,
  });
export const useToolsServiceListAllToolsAdminToolsGetSuspense = <
  TData = Common.ToolsServiceListAllToolsAdminToolsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListAllToolsAdminToolsGetKeyFn(queryKey),
    queryFn: () => ToolsService.listAllToolsAdminToolsGet() as TData,
    ...options,
  });
export const useToolsServiceGetToolApiToolsToolIdGetSuspense = <
  TData = Common.ToolsServiceGetToolApiToolsToolIdGetDefaultResponse,
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
    queryKey: Common.UseToolsServiceGetToolApiToolsToolIdGetKeyFn(
      { toolId },
      queryKey
    ),
    queryFn: () => ToolsService.getToolApiToolsToolIdGet({ toolId }) as TData,
    ...options,
  });
export const useToolsServiceGetToolIdApiToolsNameToolNameGetSuspense = <
  TData = Common.ToolsServiceGetToolIdApiToolsNameToolNameGetDefaultResponse,
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
    queryKey: Common.UseToolsServiceGetToolIdApiToolsNameToolNameGetKeyFn(
      { toolName },
      queryKey
    ),
    queryFn: () =>
      ToolsService.getToolIdApiToolsNameToolNameGet({ toolName }) as TData,
    ...options,
  });
export const useToolsServiceListAllToolsApiToolsGetSuspense = <
  TData = Common.ToolsServiceListAllToolsApiToolsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListAllToolsApiToolsGetKeyFn(queryKey),
    queryFn: () => ToolsService.listAllToolsApiToolsGet() as TData,
    ...options,
  });
export const useAgentsServiceGetAllAgentsApiAdminAgentsGetSuspense = <
  TData = Common.AgentsServiceGetAllAgentsApiAdminAgentsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey:
      Common.UseAgentsServiceGetAllAgentsApiAdminAgentsGetKeyFn(queryKey),
    queryFn: () => AgentsService.getAllAgentsApiAdminAgentsGet() as TData,
    ...options,
  });
export const useAgentsServiceListAgentsApiAgentsGetSuspense = <
  TData = Common.AgentsServiceListAgentsApiAgentsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentsApiAgentsGetKeyFn(queryKey),
    queryFn: () => AgentsService.listAgentsApiAgentsGet() as TData,
    ...options,
  });
export const useAgentsServiceGetAgentStateApiAgentsAgentIdGetSuspense = <
  TData = Common.AgentsServiceGetAgentStateApiAgentsAgentIdGetDefaultResponse,
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
    queryKey: Common.UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentStateApiAgentsAgentIdGet({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetSuspense =
  <
    TData = Common.AgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetDefaultResponse,
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
      queryKey:
        Common.UseAgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetKeyFn(
          { agentId },
          queryKey
        ),
      queryFn: () =>
        AgentsService.getAgentSourcesApiAgentsAgentIdSourcesGet({
          agentId,
        }) as TData,
      ...options,
    });
export const useAgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetSuspense =
  <
    TData = Common.AgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetDefaultResponse,
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
      queryKey:
        Common.UseAgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetKeyFn(
          { agentId },
          queryKey
        ),
      queryFn: () =>
        AgentsService.getAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGet(
          { agentId }
        ) as TData,
      ...options,
    });
export const useAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetSuspense = <
  TData = Common.AgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetDefaultResponse,
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
    queryKey:
      Common.UseAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetKeyFn(
        { agentId },
        queryKey
      ),
    queryFn: () =>
      AgentsService.getAgentMemoryApiAgentsAgentIdMemoryGet({
        agentId,
      }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetSuspense =
  <
    TData = Common.AgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetDefaultResponse,
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
      queryKey:
        Common.UseAgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetKeyFn(
          { agentId },
          queryKey
        ),
      queryFn: () =>
        AgentsService.getAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGet(
          { agentId }
        ) as TData,
      ...options,
    });
export const useAgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetSuspense =
  <
    TData = Common.AgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetDefaultResponse,
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
      queryKey:
        Common.UseAgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetKeyFn(
          { agentId },
          queryKey
        ),
      queryFn: () =>
        AgentsService.getAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGet(
          { agentId }
        ) as TData,
      ...options,
    });
export const useAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetSuspense =
  <
    TData = Common.AgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetDefaultResponse,
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
      queryKey:
        Common.UseAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetKeyFn(
          { after, agentId, before, limit },
          queryKey
        ),
      queryFn: () =>
        AgentsService.getAgentArchivalMemoryApiAgentsAgentIdArchivalGet({
          after,
          agentId,
          before,
          limit,
        }) as TData,
      ...options,
    });
export const useAgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetSuspense =
  <
    TData = Common.AgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetDefaultResponse,
    TError = unknown,
    TQueryKey extends Array<unknown> = unknown[]
  >(
    {
      agentId,
      count,
      start,
    }: {
      agentId: string;
      count: number;
      start: number;
    },
    queryKey?: TQueryKey,
    options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
  ) =>
    useSuspenseQuery<TData, TError>({
      queryKey:
        Common.UseAgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetKeyFn(
          { agentId, count, start },
          queryKey
        ),
      queryFn: () =>
        AgentsService.getAgentMessagesInContextApiAgentsAgentIdMessagesContextGet(
          { agentId, count, start }
        ) as TData,
      ...options,
    });
export const useAgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetSuspense =
  <
    TData = Common.AgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetDefaultResponse,
    TError = unknown,
    TQueryKey extends Array<unknown> = unknown[]
  >(
    {
      agentId,
      before,
      limit,
    }: {
      agentId: string;
      before?: string;
      limit?: number;
    },
    queryKey?: TQueryKey,
    options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
  ) =>
    useSuspenseQuery<TData, TError>({
      queryKey:
        Common.UseAgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetKeyFn(
          { agentId, before, limit },
          queryKey
        ),
      queryFn: () =>
        AgentsService.getAgentMessagesApiAgentsAgentIdMessagesGet({
          agentId,
          before,
          limit,
        }) as TData,
      ...options,
    });
export const useBlockServiceListBlocksApiBlocksGetSuspense = <
  TData = Common.BlockServiceListBlocksApiBlocksGetDefaultResponse,
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
    queryKey: Common.UseBlockServiceListBlocksApiBlocksGetKeyFn(
      { label, name, templatesOnly },
      queryKey
    ),
    queryFn: () =>
      BlockService.listBlocksApiBlocksGet({
        label,
        name,
        templatesOnly,
      }) as TData,
    ...options,
  });
export const useBlockServiceGetBlockApiBlocksBlockIdGetSuspense = <
  TData = Common.BlockServiceGetBlockApiBlocksBlockIdGetDefaultResponse,
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
    queryKey: Common.UseBlockServiceGetBlockApiBlocksBlockIdGetKeyFn(
      { blockId },
      queryKey
    ),
    queryFn: () =>
      BlockService.getBlockApiBlocksBlockIdGet({ blockId }) as TData,
    ...options,
  });
export const useJobsServiceListJobsApiJobsGetSuspense = <
  TData = Common.JobsServiceListJobsApiJobsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsApiJobsGetKeyFn(queryKey),
    queryFn: () => JobsService.listJobsApiJobsGet() as TData,
    ...options,
  });
export const useJobsServiceListActiveJobsApiJobsActiveGetSuspense = <
  TData = Common.JobsServiceListActiveJobsApiJobsActiveGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey:
      Common.UseJobsServiceListActiveJobsApiJobsActiveGetKeyFn(queryKey),
    queryFn: () => JobsService.listActiveJobsApiJobsActiveGet() as TData,
    ...options,
  });
export const useJobsServiceGetJobApiJobsJobIdGetSuspense = <
  TData = Common.JobsServiceGetJobApiJobsJobIdGetDefaultResponse,
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
    queryKey: Common.UseJobsServiceGetJobApiJobsJobIdGetKeyFn(
      { jobId },
      queryKey
    ),
    queryFn: () => JobsService.getJobApiJobsJobIdGet({ jobId }) as TData,
    ...options,
  });
export const useModelsServiceListModelsApiModelsGetSuspense = <
  TData = Common.ModelsServiceListModelsApiModelsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListModelsApiModelsGetKeyFn(queryKey),
    queryFn: () => ModelsService.listModelsApiModelsGet() as TData,
    ...options,
  });
export const useSourcesServiceGetSourceApiSourcesSourceIdGetSuspense = <
  TData = Common.SourcesServiceGetSourceApiSourcesSourceIdGetDefaultResponse,
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
    queryKey: Common.UseSourcesServiceGetSourceApiSourcesSourceIdGetKeyFn(
      { sourceId },
      queryKey
    ),
    queryFn: () =>
      SourcesService.getSourceApiSourcesSourceIdGet({ sourceId }) as TData,
    ...options,
  });
export const useSourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetSuspense =
  <
    TData = Common.SourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetDefaultResponse,
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
      queryKey:
        Common.UseSourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetKeyFn(
          { sourceName },
          queryKey
        ),
      queryFn: () =>
        SourcesService.getSourceIdByNameApiSourcesNameSourceNameGet({
          sourceName,
        }) as TData,
      ...options,
    });
export const useSourcesServiceListSourcesApiSourcesGetSuspense = <
  TData = Common.SourcesServiceListSourcesApiSourcesGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesApiSourcesGetKeyFn(queryKey),
    queryFn: () => SourcesService.listSourcesApiSourcesGet() as TData,
    ...options,
  });
export const useSourcesServiceGetJobApiSourcesStatusJobIdGetSuspense = <
  TData = Common.SourcesServiceGetJobApiSourcesStatusJobIdGetDefaultResponse,
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
    queryKey: Common.UseSourcesServiceGetJobApiSourcesStatusJobIdGetKeyFn(
      { jobId },
      queryKey
    ),
    queryFn: () =>
      SourcesService.getJobApiSourcesStatusJobIdGet({ jobId }) as TData,
    ...options,
  });
export const useSourcesServiceListPassagesApiSourcesSourceIdPassagesGetSuspense =
  <
    TData = Common.SourcesServiceListPassagesApiSourcesSourceIdPassagesGetDefaultResponse,
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
      queryKey:
        Common.UseSourcesServiceListPassagesApiSourcesSourceIdPassagesGetKeyFn(
          { sourceId },
          queryKey
        ),
      queryFn: () =>
        SourcesService.listPassagesApiSourcesSourceIdPassagesGet({
          sourceId,
        }) as TData,
      ...options,
    });
export const useSourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetSuspense =
  <
    TData = Common.SourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetDefaultResponse,
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
      queryKey:
        Common.UseSourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetKeyFn(
          { sourceId },
          queryKey
        ),
      queryFn: () =>
        SourcesService.listDocumentsApiSourcesSourceIdDocumentsGet({
          sourceId,
        }) as TData,
      ...options,
    });
export const useConfigServiceGetLlmConfigsApiConfigLlmGetSuspense = <
  TData = Common.ConfigServiceGetLlmConfigsApiConfigLlmGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useSuspenseQuery<TData, TError>({
    queryKey:
      Common.UseConfigServiceGetLlmConfigsApiConfigLlmGetKeyFn(queryKey),
    queryFn: () => ConfigService.getLlmConfigsApiConfigLlmGet() as TData,
    ...options,
  });
export const useConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetSuspense =
  <
    TData = Common.ConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetDefaultResponse,
    TError = unknown,
    TQueryKey extends Array<unknown> = unknown[]
  >(
    queryKey?: TQueryKey,
    options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
  ) =>
    useSuspenseQuery<TData, TError>({
      queryKey:
        Common.UseConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetKeyFn(
          queryKey
        ),
      queryFn: () =>
        ConfigService.getEmbeddingConfigsApiConfigEmbeddingGet() as TData,
      ...options,
    });

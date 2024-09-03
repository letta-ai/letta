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
  BlockService,
  ConfigService,
  JobsService,
  ModelsService,
  SourcesService,
  ToolsService,
} from '../requests/services.gen';
import {
  APIKeyCreate,
  AuthRequest,
  Body_upload_file_to_source_api_sources__source_id__upload_post,
  CreateAgent,
  CreateArchivalMemory,
  CreateBlock,
  CreateToolRequest,
  MemGPTRequest,
  SourceCreate,
  SourceUpdate,
  ToolCreate,
  ToolUpdate,
  UpdateAgentState,
  UpdateBlock,
  UserCreate,
} from '../requests/types.gen';
import * as Common from './common';
export const useAdminServiceGetAllUsersAdminUsersGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceGetAllUsersAdminUsersGetKeyFn(
      { cursor, limit },
      queryKey
    ),
    queryFn: () =>
      AdminService.getAllUsersAdminUsersGet({ cursor, limit }) as TData,
    ...options,
  });
export const useAdminServiceGetApiKeysAdminUsersKeysGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseAdminServiceGetApiKeysAdminUsersKeysGetKeyFn(
      { userId },
      queryKey
    ),
    queryFn: () =>
      AdminService.getApiKeysAdminUsersKeysGet({ userId }) as TData,
    ...options,
  });
export const useToolsServiceGetToolAdminToolsToolNameGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolAdminToolsToolNameGetKeyFn(
      { toolName },
      queryKey
    ),
    queryFn: () =>
      ToolsService.getToolAdminToolsToolNameGet({ toolName }) as TData,
    ...options,
  });
export const useToolsServiceListAllToolsAdminToolsGet = <
  TData = Common.ToolsServiceListAllToolsAdminToolsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListAllToolsAdminToolsGetKeyFn(queryKey),
    queryFn: () => ToolsService.listAllToolsAdminToolsGet() as TData,
    ...options,
  });
export const useToolsServiceGetToolApiToolsToolIdGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolApiToolsToolIdGetKeyFn(
      { toolId },
      queryKey
    ),
    queryFn: () => ToolsService.getToolApiToolsToolIdGet({ toolId }) as TData,
    ...options,
  });
export const useToolsServiceGetToolIdApiToolsNameToolNameGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolIdApiToolsNameToolNameGetKeyFn(
      { toolName },
      queryKey
    ),
    queryFn: () =>
      ToolsService.getToolIdApiToolsNameToolNameGet({ toolName }) as TData,
    ...options,
  });
export const useToolsServiceListAllToolsApiToolsGet = <
  TData = Common.ToolsServiceListAllToolsApiToolsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListAllToolsApiToolsGetKeyFn(queryKey),
    queryFn: () => ToolsService.listAllToolsApiToolsGet() as TData,
    ...options,
  });
export const useAgentsServiceGetAllAgentsApiAdminAgentsGet = <
  TData = Common.AgentsServiceGetAllAgentsApiAdminAgentsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey:
      Common.UseAgentsServiceGetAllAgentsApiAdminAgentsGetKeyFn(queryKey),
    queryFn: () => AgentsService.getAllAgentsApiAdminAgentsGet() as TData,
    ...options,
  });
export const useAgentsServiceListAgentsApiAgentsGet = <
  TData = Common.AgentsServiceListAgentsApiAgentsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentsApiAgentsGetKeyFn(queryKey),
    queryFn: () => AgentsService.listAgentsApiAgentsGet() as TData,
    ...options,
  });
export const useAgentsServiceGetAgentStateApiAgentsAgentIdGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn(
      { agentId },
      queryKey
    ),
    queryFn: () =>
      AgentsService.getAgentStateApiAgentsAgentIdGet({ agentId }) as TData,
    ...options,
  });
export const useAgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGet = <
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
  useQuery<TData, TError>({
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
export const useAgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGet =
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
    useQuery<TData, TError>({
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
export const useAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGet = <
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
  useQuery<TData, TError>({
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
export const useAgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGet =
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
    useQuery<TData, TError>({
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
export const useAgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGet =
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
    useQuery<TData, TError>({
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
export const useAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGet =
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
    useQuery<TData, TError>({
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
export const useAgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGet =
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
    useQuery<TData, TError>({
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
export const useAgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGet = <
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
  useQuery<TData, TError>({
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
export const useBlockServiceListBlocksApiBlocksGet = <
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
  useQuery<TData, TError>({
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
export const useBlockServiceGetBlockApiBlocksBlockIdGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseBlockServiceGetBlockApiBlocksBlockIdGetKeyFn(
      { blockId },
      queryKey
    ),
    queryFn: () =>
      BlockService.getBlockApiBlocksBlockIdGet({ blockId }) as TData,
    ...options,
  });
export const useJobsServiceListJobsApiJobsGet = <
  TData = Common.JobsServiceListJobsApiJobsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsApiJobsGetKeyFn(queryKey),
    queryFn: () => JobsService.listJobsApiJobsGet() as TData,
    ...options,
  });
export const useJobsServiceListActiveJobsApiJobsActiveGet = <
  TData = Common.JobsServiceListActiveJobsApiJobsActiveGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey:
      Common.UseJobsServiceListActiveJobsApiJobsActiveGetKeyFn(queryKey),
    queryFn: () => JobsService.listActiveJobsApiJobsActiveGet() as TData,
    ...options,
  });
export const useJobsServiceGetJobApiJobsJobIdGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceGetJobApiJobsJobIdGetKeyFn(
      { jobId },
      queryKey
    ),
    queryFn: () => JobsService.getJobApiJobsJobIdGet({ jobId }) as TData,
    ...options,
  });
export const useModelsServiceListModelsApiModelsGet = <
  TData = Common.ModelsServiceListModelsApiModelsGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseModelsServiceListModelsApiModelsGetKeyFn(queryKey),
    queryFn: () => ModelsService.listModelsApiModelsGet() as TData,
    ...options,
  });
export const useSourcesServiceGetSourceApiSourcesSourceIdGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceApiSourcesSourceIdGetKeyFn(
      { sourceId },
      queryKey
    ),
    queryFn: () =>
      SourcesService.getSourceApiSourcesSourceIdGet({ sourceId }) as TData,
    ...options,
  });
export const useSourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGet = <
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
  useQuery<TData, TError>({
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
export const useSourcesServiceListSourcesApiSourcesGet = <
  TData = Common.SourcesServiceListSourcesApiSourcesGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesApiSourcesGetKeyFn(queryKey),
    queryFn: () => SourcesService.listSourcesApiSourcesGet() as TData,
    ...options,
  });
export const useSourcesServiceGetJobApiSourcesStatusJobIdGet = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetJobApiSourcesStatusJobIdGetKeyFn(
      { jobId },
      queryKey
    ),
    queryFn: () =>
      SourcesService.getJobApiSourcesStatusJobIdGet({ jobId }) as TData,
    ...options,
  });
export const useSourcesServiceListPassagesApiSourcesSourceIdPassagesGet = <
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
  useQuery<TData, TError>({
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
export const useSourcesServiceListDocumentsApiSourcesSourceIdDocumentsGet = <
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
  useQuery<TData, TError>({
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
export const useConfigServiceGetLlmConfigsApiConfigLlmGet = <
  TData = Common.ConfigServiceGetLlmConfigsApiConfigLlmGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey:
      Common.UseConfigServiceGetLlmConfigsApiConfigLlmGetKeyFn(queryKey),
    queryFn: () => ConfigService.getLlmConfigsApiConfigLlmGet() as TData,
    ...options,
  });
export const useConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGet = <
  TData = Common.ConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey:
      Common.UseConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetKeyFn(
        queryKey
      ),
    queryFn: () =>
      ConfigService.getEmbeddingConfigsApiConfigEmbeddingGet() as TData,
    ...options,
  });
export const useAuthServiceAuthenticateUserApiAuthPost = <
  TData = Common.AuthServiceAuthenticateUserApiAuthPostMutationResult,
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
      AuthService.authenticateUserApiAuthPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAdminServiceCreateUserAdminUsersPost = <
  TData = Common.AdminServiceCreateUserAdminUsersPostMutationResult,
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
      AdminService.createUserAdminUsersPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAdminServiceCreateNewApiKeyAdminUsersKeysPost = <
  TData = Common.AdminServiceCreateNewApiKeyAdminUsersKeysPostMutationResult,
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
      AdminService.createNewApiKeyAdminUsersKeysPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useToolsServiceCreateToolAdminToolsPost = <
  TData = Common.ToolsServiceCreateToolAdminToolsPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CreateToolRequest;
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
      requestBody: CreateToolRequest;
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      ToolsService.createToolAdminToolsPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useToolsServiceUpdateToolApiToolsToolIdPost = <
  TData = Common.ToolsServiceUpdateToolApiToolsToolIdPostMutationResult,
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
    },
    TContext
  >({
    mutationFn: ({ requestBody, toolId }) =>
      ToolsService.updateToolApiToolsToolIdPost({
        requestBody,
        toolId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useToolsServiceCreateToolApiToolsPost = <
  TData = Common.ToolsServiceCreateToolApiToolsPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: ToolCreate;
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
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      ToolsService.createToolApiToolsPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceCreateAgentApiAgentsPost = <
  TData = Common.AgentsServiceCreateAgentApiAgentsPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CreateAgent;
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
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      AgentsService.createAgentApiAgentsPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceUpdateAgentApiAgentsAgentIdPost = <
  TData = Common.AgentsServiceUpdateAgentApiAgentsAgentIdPostMutationResult,
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
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody }) =>
      AgentsService.updateAgentApiAgentsAgentIdPost({
        agentId,
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceUpdateAgentMemoryApiAgentsAgentIdMemoryPost = <
  TData = Common.AgentsServiceUpdateAgentMemoryApiAgentsAgentIdMemoryPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: { [key: string]: unknown };
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
      requestBody: { [key: string]: unknown };
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody }) =>
      AgentsService.updateAgentMemoryApiAgentsAgentIdMemoryPost({
        agentId,
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceInsertAgentArchivalMemoryApiAgentsAgentIdArchivalPost =
  <
    TData = Common.AgentsServiceInsertAgentArchivalMemoryApiAgentsAgentIdArchivalPostMutationResult,
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
      },
      TContext
    >({
      mutationFn: ({ agentId, requestBody }) =>
        AgentsService.insertAgentArchivalMemoryApiAgentsAgentIdArchivalPost({
          agentId,
          requestBody,
        }) as unknown as Promise<TData>,
      ...options,
    });
export const useAgentsServiceSendMessageApiAgentsAgentIdMessagesPost = <
  TData = Common.AgentsServiceSendMessageApiAgentsAgentIdMessagesPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
        requestBody: MemGPTRequest;
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
      requestBody: MemGPTRequest;
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody }) =>
      AgentsService.sendMessageApiAgentsAgentIdMessagesPost({
        agentId,
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useBlockServiceCreateBlockApiBlocksPost = <
  TData = Common.BlockServiceCreateBlockApiBlocksPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: CreateBlock;
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
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      BlockService.createBlockApiBlocksPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useBlockServiceUpdateBlockApiBlocksBlockIdPost = <
  TData = Common.BlockServiceUpdateBlockApiBlocksBlockIdPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        blockId: string;
        requestBody: UpdateBlock;
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
      requestBody: UpdateBlock;
    },
    TContext
  >({
    mutationFn: ({ blockId, requestBody }) =>
      BlockService.updateBlockApiBlocksBlockIdPost({
        blockId,
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useSourcesServiceUpdateSourceApiSourcesSourceIdPost = <
  TData = Common.SourcesServiceUpdateSourceApiSourcesSourceIdPostMutationResult,
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
    },
    TContext
  >({
    mutationFn: ({ requestBody, sourceId }) =>
      SourcesService.updateSourceApiSourcesSourceIdPost({
        requestBody,
        sourceId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useSourcesServiceCreateSourceApiSourcesPost = <
  TData = Common.SourcesServiceCreateSourceApiSourcesPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        requestBody: SourceCreate;
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
    },
    TContext
  >({
    mutationFn: ({ requestBody }) =>
      SourcesService.createSourceApiSourcesPost({
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useSourcesServiceAttachSourceToAgentApiSourcesSourceIdAttachPost =
  <
    TData = Common.SourcesServiceAttachSourceToAgentApiSourcesSourceIdAttachPostMutationResult,
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
      },
      TContext
    >({
      mutationFn: ({ agentId, sourceId }) =>
        SourcesService.attachSourceToAgentApiSourcesSourceIdAttachPost({
          agentId,
          sourceId,
        }) as unknown as Promise<TData>,
      ...options,
    });
export const useSourcesServiceDetachSourceFromAgentApiSourcesSourceIdDetachPost =
  <
    TData = Common.SourcesServiceDetachSourceFromAgentApiSourcesSourceIdDetachPostMutationResult,
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
      },
      TContext
    >({
      mutationFn: ({ agentId, sourceId }) =>
        SourcesService.detachSourceFromAgentApiSourcesSourceIdDetachPost({
          agentId,
          sourceId,
        }) as unknown as Promise<TData>,
      ...options,
    });
export const useSourcesServiceUploadFileToSourceApiSourcesSourceIdUploadPost = <
  TData = Common.SourcesServiceUploadFileToSourceApiSourcesSourceIdUploadPostMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        formData: Body_upload_file_to_source_api_sources__source_id__upload_post;
        sourceId: string;
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
      formData: Body_upload_file_to_source_api_sources__source_id__upload_post;
      sourceId: string;
    },
    TContext
  >({
    mutationFn: ({ formData, sourceId }) =>
      SourcesService.uploadFileToSourceApiSourcesSourceIdUploadPost({
        formData,
        sourceId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAdminServiceDeleteUserAdminUsersDelete = <
  TData = Common.AdminServiceDeleteUserAdminUsersDeleteMutationResult,
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
      AdminService.deleteUserAdminUsersDelete({
        userId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAdminServiceDeleteApiKeyAdminUsersKeysDelete = <
  TData = Common.AdminServiceDeleteApiKeyAdminUsersKeysDeleteMutationResult,
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
      AdminService.deleteApiKeyAdminUsersKeysDelete({
        apiKey,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useToolsServiceDeleteToolAdminToolsToolNameDelete = <
  TData = Common.ToolsServiceDeleteToolAdminToolsToolNameDeleteMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        toolName: string;
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
      toolName: string;
    },
    TContext
  >({
    mutationFn: ({ toolName }) =>
      ToolsService.deleteToolAdminToolsToolNameDelete({
        toolName,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useToolsServiceDeleteToolApiToolsToolIdDelete = <
  TData = Common.ToolsServiceDeleteToolApiToolsToolIdDeleteMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        toolId: string;
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
    },
    TContext
  >({
    mutationFn: ({ toolId }) =>
      ToolsService.deleteToolApiToolsToolIdDelete({
        toolId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceDeleteAgentApiAgentsAgentIdDelete = <
  TData = Common.AgentsServiceDeleteAgentApiAgentsAgentIdDeleteMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        agentId: string;
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
    },
    TContext
  >({
    mutationFn: ({ agentId }) =>
      AgentsService.deleteAgentApiAgentsAgentIdDelete({
        agentId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceDeleteAgentArchivalMemoryApiAgentsAgentIdArchivalMemoryIdDelete =
  <
    TData = Common.AgentsServiceDeleteAgentArchivalMemoryApiAgentsAgentIdArchivalMemoryIdDeleteMutationResult,
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
      },
      TContext
    >({
      mutationFn: ({ agentId, memoryId }) =>
        AgentsService.deleteAgentArchivalMemoryApiAgentsAgentIdArchivalMemoryIdDelete(
          { agentId, memoryId }
        ) as unknown as Promise<TData>,
      ...options,
    });
export const useBlockServiceDeleteBlockApiBlocksBlockIdDelete = <
  TData = Common.BlockServiceDeleteBlockApiBlocksBlockIdDeleteMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        blockId: string;
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
    },
    TContext
  >({
    mutationFn: ({ blockId }) =>
      BlockService.deleteBlockApiBlocksBlockIdDelete({
        blockId,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useSourcesServiceDeleteSourceApiSourcesSourceIdDelete = <
  TData = Common.SourcesServiceDeleteSourceApiSourcesSourceIdDeleteMutationResult,
  TError = unknown,
  TContext = unknown
>(
  options?: Omit<
    UseMutationOptions<
      TData,
      TError,
      {
        sourceId: string;
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
    },
    TContext
  >({
    mutationFn: ({ sourceId }) =>
      SourcesService.deleteSourceApiSourcesSourceIdDelete({
        sourceId,
      }) as unknown as Promise<TData>,
    ...options,
  });

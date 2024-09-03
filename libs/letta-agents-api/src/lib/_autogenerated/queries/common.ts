// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { UseQueryResult } from '@tanstack/react-query';
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
export type AdminServiceGetAllUsersAdminUsersGetDefaultResponse = Awaited<
  ReturnType<typeof AdminService.getAllUsersAdminUsersGet>
>;
export type AdminServiceGetAllUsersAdminUsersGetQueryResult<
  TData = AdminServiceGetAllUsersAdminUsersGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAdminServiceGetAllUsersAdminUsersGetKey =
  'AdminServiceGetAllUsersAdminUsersGet';
export const UseAdminServiceGetAllUsersAdminUsersGetKeyFn = (
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  queryKey?: Array<unknown>
) => [
  useAdminServiceGetAllUsersAdminUsersGetKey,
  ...(queryKey ?? [{ cursor, limit }]),
];
export type AdminServiceGetApiKeysAdminUsersKeysGetDefaultResponse = Awaited<
  ReturnType<typeof AdminService.getApiKeysAdminUsersKeysGet>
>;
export type AdminServiceGetApiKeysAdminUsersKeysGetQueryResult<
  TData = AdminServiceGetApiKeysAdminUsersKeysGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAdminServiceGetApiKeysAdminUsersKeysGetKey =
  'AdminServiceGetApiKeysAdminUsersKeysGet';
export const UseAdminServiceGetApiKeysAdminUsersKeysGetKeyFn = (
  {
    userId,
  }: {
    userId: string;
  },
  queryKey?: Array<unknown>
) => [
  useAdminServiceGetApiKeysAdminUsersKeysGetKey,
  ...(queryKey ?? [{ userId }]),
];
export type ToolsServiceGetToolAdminToolsToolNameGetDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.getToolAdminToolsToolNameGet>
>;
export type ToolsServiceGetToolAdminToolsToolNameGetQueryResult<
  TData = ToolsServiceGetToolAdminToolsToolNameGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useToolsServiceGetToolAdminToolsToolNameGetKey =
  'ToolsServiceGetToolAdminToolsToolNameGet';
export const UseToolsServiceGetToolAdminToolsToolNameGetKeyFn = (
  {
    toolName,
  }: {
    toolName: string;
  },
  queryKey?: Array<unknown>
) => [
  useToolsServiceGetToolAdminToolsToolNameGetKey,
  ...(queryKey ?? [{ toolName }]),
];
export type ToolsServiceListAllToolsAdminToolsGetDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.listAllToolsAdminToolsGet>
>;
export type ToolsServiceListAllToolsAdminToolsGetQueryResult<
  TData = ToolsServiceListAllToolsAdminToolsGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useToolsServiceListAllToolsAdminToolsGetKey =
  'ToolsServiceListAllToolsAdminToolsGet';
export const UseToolsServiceListAllToolsAdminToolsGetKeyFn = (
  queryKey?: Array<unknown>
) => [useToolsServiceListAllToolsAdminToolsGetKey, ...(queryKey ?? [])];
export type ToolsServiceGetToolApiToolsToolIdGetDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.getToolApiToolsToolIdGet>
>;
export type ToolsServiceGetToolApiToolsToolIdGetQueryResult<
  TData = ToolsServiceGetToolApiToolsToolIdGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useToolsServiceGetToolApiToolsToolIdGetKey =
  'ToolsServiceGetToolApiToolsToolIdGet';
export const UseToolsServiceGetToolApiToolsToolIdGetKeyFn = (
  {
    toolId,
  }: {
    toolId: string;
  },
  queryKey?: Array<unknown>
) => [
  useToolsServiceGetToolApiToolsToolIdGetKey,
  ...(queryKey ?? [{ toolId }]),
];
export type ToolsServiceGetToolIdApiToolsNameToolNameGetDefaultResponse =
  Awaited<ReturnType<typeof ToolsService.getToolIdApiToolsNameToolNameGet>>;
export type ToolsServiceGetToolIdApiToolsNameToolNameGetQueryResult<
  TData = ToolsServiceGetToolIdApiToolsNameToolNameGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useToolsServiceGetToolIdApiToolsNameToolNameGetKey =
  'ToolsServiceGetToolIdApiToolsNameToolNameGet';
export const UseToolsServiceGetToolIdApiToolsNameToolNameGetKeyFn = (
  {
    toolName,
  }: {
    toolName: string;
  },
  queryKey?: Array<unknown>
) => [
  useToolsServiceGetToolIdApiToolsNameToolNameGetKey,
  ...(queryKey ?? [{ toolName }]),
];
export type ToolsServiceListAllToolsApiToolsGetDefaultResponse = Awaited<
  ReturnType<typeof ToolsService.listAllToolsApiToolsGet>
>;
export type ToolsServiceListAllToolsApiToolsGetQueryResult<
  TData = ToolsServiceListAllToolsApiToolsGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useToolsServiceListAllToolsApiToolsGetKey =
  'ToolsServiceListAllToolsApiToolsGet';
export const UseToolsServiceListAllToolsApiToolsGetKeyFn = (
  queryKey?: Array<unknown>
) => [useToolsServiceListAllToolsApiToolsGetKey, ...(queryKey ?? [])];
export type AgentsServiceGetAllAgentsApiAdminAgentsGetDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.getAllAgentsApiAdminAgentsGet>
>;
export type AgentsServiceGetAllAgentsApiAdminAgentsGetQueryResult<
  TData = AgentsServiceGetAllAgentsApiAdminAgentsGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAllAgentsApiAdminAgentsGetKey =
  'AgentsServiceGetAllAgentsApiAdminAgentsGet';
export const UseAgentsServiceGetAllAgentsApiAdminAgentsGetKeyFn = (
  queryKey?: Array<unknown>
) => [useAgentsServiceGetAllAgentsApiAdminAgentsGetKey, ...(queryKey ?? [])];
export type AgentsServiceListAgentsApiAgentsGetDefaultResponse = Awaited<
  ReturnType<typeof AgentsService.listAgentsApiAgentsGet>
>;
export type AgentsServiceListAgentsApiAgentsGetQueryResult<
  TData = AgentsServiceListAgentsApiAgentsGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceListAgentsApiAgentsGetKey =
  'AgentsServiceListAgentsApiAgentsGet';
export const UseAgentsServiceListAgentsApiAgentsGetKeyFn = (
  queryKey?: Array<unknown>
) => [useAgentsServiceListAgentsApiAgentsGetKey, ...(queryKey ?? [])];
export type AgentsServiceGetAgentStateApiAgentsAgentIdGetDefaultResponse =
  Awaited<ReturnType<typeof AgentsService.getAgentStateApiAgentsAgentIdGet>>;
export type AgentsServiceGetAgentStateApiAgentsAgentIdGetQueryResult<
  TData = AgentsServiceGetAgentStateApiAgentsAgentIdGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentStateApiAgentsAgentIdGetKey =
  'AgentsServiceGetAgentStateApiAgentsAgentIdGet';
export const UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn = (
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: Array<unknown>
) => [
  useAgentsServiceGetAgentStateApiAgentsAgentIdGetKey,
  ...(queryKey ?? [{ agentId }]),
];
export type AgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetDefaultResponse =
  Awaited<
    ReturnType<typeof AgentsService.getAgentSourcesApiAgentsAgentIdSourcesGet>
  >;
export type AgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetQueryResult<
  TData = AgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetKey =
  'AgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGet';
export const UseAgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetKeyFn = (
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: Array<unknown>
) => [
  useAgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetKey,
  ...(queryKey ?? [{ agentId }]),
];
export type AgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetDefaultResponse =
  Awaited<
    ReturnType<
      typeof AgentsService.getAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGet
    >
  >;
export type AgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetQueryResult<
  TData = AgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetKey =
  'AgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGet';
export const UseAgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetKeyFn =
  (
    {
      agentId,
    }: {
      agentId: string;
    },
    queryKey?: Array<unknown>
  ) => [
    useAgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetKey,
    ...(queryKey ?? [{ agentId }]),
  ];
export type AgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetDefaultResponse =
  Awaited<
    ReturnType<typeof AgentsService.getAgentMemoryApiAgentsAgentIdMemoryGet>
  >;
export type AgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetQueryResult<
  TData = AgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetKey =
  'AgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGet';
export const UseAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetKeyFn = (
  {
    agentId,
  }: {
    agentId: string;
  },
  queryKey?: Array<unknown>
) => [
  useAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetKey,
  ...(queryKey ?? [{ agentId }]),
];
export type AgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetDefaultResponse =
  Awaited<
    ReturnType<
      typeof AgentsService.getAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGet
    >
  >;
export type AgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetQueryResult<
  TData = AgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetKey =
  'AgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGet';
export const UseAgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetKeyFn =
  (
    {
      agentId,
    }: {
      agentId: string;
    },
    queryKey?: Array<unknown>
  ) => [
    useAgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetKey,
    ...(queryKey ?? [{ agentId }]),
  ];
export type AgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetDefaultResponse =
  Awaited<
    ReturnType<
      typeof AgentsService.getAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGet
    >
  >;
export type AgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetQueryResult<
  TData = AgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetKey =
  'AgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGet';
export const UseAgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetKeyFn =
  (
    {
      agentId,
    }: {
      agentId: string;
    },
    queryKey?: Array<unknown>
  ) => [
    useAgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetKey,
    ...(queryKey ?? [{ agentId }]),
  ];
export type AgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetDefaultResponse =
  Awaited<
    ReturnType<
      typeof AgentsService.getAgentArchivalMemoryApiAgentsAgentIdArchivalGet
    >
  >;
export type AgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetQueryResult<
  TData = AgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetKey =
  'AgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGet';
export const UseAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetKeyFn =
  (
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
    queryKey?: Array<unknown>
  ) => [
    useAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetKey,
    ...(queryKey ?? [{ after, agentId, before, limit }]),
  ];
export type AgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetDefaultResponse =
  Awaited<
    ReturnType<
      typeof AgentsService.getAgentMessagesInContextApiAgentsAgentIdMessagesContextGet
    >
  >;
export type AgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetQueryResult<
  TData = AgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetKey =
  'AgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGet';
export const UseAgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetKeyFn =
  (
    {
      agentId,
      count,
      start,
    }: {
      agentId: string;
      count: number;
      start: number;
    },
    queryKey?: Array<unknown>
  ) => [
    useAgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetKey,
    ...(queryKey ?? [{ agentId, count, start }]),
  ];
export type AgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetDefaultResponse =
  Awaited<
    ReturnType<typeof AgentsService.getAgentMessagesApiAgentsAgentIdMessagesGet>
  >;
export type AgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetQueryResult<
  TData = AgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useAgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetKey =
  'AgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGet';
export const UseAgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetKeyFn =
  (
    {
      agentId,
      before,
      limit,
    }: {
      agentId: string;
      before?: string;
      limit?: number;
    },
    queryKey?: Array<unknown>
  ) => [
    useAgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetKey,
    ...(queryKey ?? [{ agentId, before, limit }]),
  ];
export type BlockServiceListBlocksApiBlocksGetDefaultResponse = Awaited<
  ReturnType<typeof BlockService.listBlocksApiBlocksGet>
>;
export type BlockServiceListBlocksApiBlocksGetQueryResult<
  TData = BlockServiceListBlocksApiBlocksGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useBlockServiceListBlocksApiBlocksGetKey =
  'BlockServiceListBlocksApiBlocksGet';
export const UseBlockServiceListBlocksApiBlocksGetKeyFn = (
  {
    label,
    name,
    templatesOnly,
  }: {
    label?: string;
    name?: string;
    templatesOnly?: boolean;
  } = {},
  queryKey?: Array<unknown>
) => [
  useBlockServiceListBlocksApiBlocksGetKey,
  ...(queryKey ?? [{ label, name, templatesOnly }]),
];
export type BlockServiceGetBlockApiBlocksBlockIdGetDefaultResponse = Awaited<
  ReturnType<typeof BlockService.getBlockApiBlocksBlockIdGet>
>;
export type BlockServiceGetBlockApiBlocksBlockIdGetQueryResult<
  TData = BlockServiceGetBlockApiBlocksBlockIdGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useBlockServiceGetBlockApiBlocksBlockIdGetKey =
  'BlockServiceGetBlockApiBlocksBlockIdGet';
export const UseBlockServiceGetBlockApiBlocksBlockIdGetKeyFn = (
  {
    blockId,
  }: {
    blockId: string;
  },
  queryKey?: Array<unknown>
) => [
  useBlockServiceGetBlockApiBlocksBlockIdGetKey,
  ...(queryKey ?? [{ blockId }]),
];
export type JobsServiceListJobsApiJobsGetDefaultResponse = Awaited<
  ReturnType<typeof JobsService.listJobsApiJobsGet>
>;
export type JobsServiceListJobsApiJobsGetQueryResult<
  TData = JobsServiceListJobsApiJobsGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useJobsServiceListJobsApiJobsGetKey =
  'JobsServiceListJobsApiJobsGet';
export const UseJobsServiceListJobsApiJobsGetKeyFn = (
  queryKey?: Array<unknown>
) => [useJobsServiceListJobsApiJobsGetKey, ...(queryKey ?? [])];
export type JobsServiceListActiveJobsApiJobsActiveGetDefaultResponse = Awaited<
  ReturnType<typeof JobsService.listActiveJobsApiJobsActiveGet>
>;
export type JobsServiceListActiveJobsApiJobsActiveGetQueryResult<
  TData = JobsServiceListActiveJobsApiJobsActiveGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useJobsServiceListActiveJobsApiJobsActiveGetKey =
  'JobsServiceListActiveJobsApiJobsActiveGet';
export const UseJobsServiceListActiveJobsApiJobsActiveGetKeyFn = (
  queryKey?: Array<unknown>
) => [useJobsServiceListActiveJobsApiJobsActiveGetKey, ...(queryKey ?? [])];
export type JobsServiceGetJobApiJobsJobIdGetDefaultResponse = Awaited<
  ReturnType<typeof JobsService.getJobApiJobsJobIdGet>
>;
export type JobsServiceGetJobApiJobsJobIdGetQueryResult<
  TData = JobsServiceGetJobApiJobsJobIdGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useJobsServiceGetJobApiJobsJobIdGetKey =
  'JobsServiceGetJobApiJobsJobIdGet';
export const UseJobsServiceGetJobApiJobsJobIdGetKeyFn = (
  {
    jobId,
  }: {
    jobId: string;
  },
  queryKey?: Array<unknown>
) => [useJobsServiceGetJobApiJobsJobIdGetKey, ...(queryKey ?? [{ jobId }])];
export type ModelsServiceListModelsApiModelsGetDefaultResponse = Awaited<
  ReturnType<typeof ModelsService.listModelsApiModelsGet>
>;
export type ModelsServiceListModelsApiModelsGetQueryResult<
  TData = ModelsServiceListModelsApiModelsGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useModelsServiceListModelsApiModelsGetKey =
  'ModelsServiceListModelsApiModelsGet';
export const UseModelsServiceListModelsApiModelsGetKeyFn = (
  queryKey?: Array<unknown>
) => [useModelsServiceListModelsApiModelsGetKey, ...(queryKey ?? [])];
export type SourcesServiceGetSourceApiSourcesSourceIdGetDefaultResponse =
  Awaited<ReturnType<typeof SourcesService.getSourceApiSourcesSourceIdGet>>;
export type SourcesServiceGetSourceApiSourcesSourceIdGetQueryResult<
  TData = SourcesServiceGetSourceApiSourcesSourceIdGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceGetSourceApiSourcesSourceIdGetKey =
  'SourcesServiceGetSourceApiSourcesSourceIdGet';
export const UseSourcesServiceGetSourceApiSourcesSourceIdGetKeyFn = (
  {
    sourceId,
  }: {
    sourceId: string;
  },
  queryKey?: Array<unknown>
) => [
  useSourcesServiceGetSourceApiSourcesSourceIdGetKey,
  ...(queryKey ?? [{ sourceId }]),
];
export type SourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetDefaultResponse =
  Awaited<
    ReturnType<
      typeof SourcesService.getSourceIdByNameApiSourcesNameSourceNameGet
    >
  >;
export type SourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetQueryResult<
  TData = SourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetKey =
  'SourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGet';
export const UseSourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetKeyFn =
  (
    {
      sourceName,
    }: {
      sourceName: string;
    },
    queryKey?: Array<unknown>
  ) => [
    useSourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetKey,
    ...(queryKey ?? [{ sourceName }]),
  ];
export type SourcesServiceListSourcesApiSourcesGetDefaultResponse = Awaited<
  ReturnType<typeof SourcesService.listSourcesApiSourcesGet>
>;
export type SourcesServiceListSourcesApiSourcesGetQueryResult<
  TData = SourcesServiceListSourcesApiSourcesGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceListSourcesApiSourcesGetKey =
  'SourcesServiceListSourcesApiSourcesGet';
export const UseSourcesServiceListSourcesApiSourcesGetKeyFn = (
  queryKey?: Array<unknown>
) => [useSourcesServiceListSourcesApiSourcesGetKey, ...(queryKey ?? [])];
export type SourcesServiceGetJobApiSourcesStatusJobIdGetDefaultResponse =
  Awaited<ReturnType<typeof SourcesService.getJobApiSourcesStatusJobIdGet>>;
export type SourcesServiceGetJobApiSourcesStatusJobIdGetQueryResult<
  TData = SourcesServiceGetJobApiSourcesStatusJobIdGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceGetJobApiSourcesStatusJobIdGetKey =
  'SourcesServiceGetJobApiSourcesStatusJobIdGet';
export const UseSourcesServiceGetJobApiSourcesStatusJobIdGetKeyFn = (
  {
    jobId,
  }: {
    jobId: string;
  },
  queryKey?: Array<unknown>
) => [
  useSourcesServiceGetJobApiSourcesStatusJobIdGetKey,
  ...(queryKey ?? [{ jobId }]),
];
export type SourcesServiceListPassagesApiSourcesSourceIdPassagesGetDefaultResponse =
  Awaited<
    ReturnType<typeof SourcesService.listPassagesApiSourcesSourceIdPassagesGet>
  >;
export type SourcesServiceListPassagesApiSourcesSourceIdPassagesGetQueryResult<
  TData = SourcesServiceListPassagesApiSourcesSourceIdPassagesGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceListPassagesApiSourcesSourceIdPassagesGetKey =
  'SourcesServiceListPassagesApiSourcesSourceIdPassagesGet';
export const UseSourcesServiceListPassagesApiSourcesSourceIdPassagesGetKeyFn = (
  {
    sourceId,
  }: {
    sourceId: string;
  },
  queryKey?: Array<unknown>
) => [
  useSourcesServiceListPassagesApiSourcesSourceIdPassagesGetKey,
  ...(queryKey ?? [{ sourceId }]),
];
export type SourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetDefaultResponse =
  Awaited<
    ReturnType<
      typeof SourcesService.listDocumentsApiSourcesSourceIdDocumentsGet
    >
  >;
export type SourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetQueryResult<
  TData = SourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useSourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetKey =
  'SourcesServiceListDocumentsApiSourcesSourceIdDocumentsGet';
export const UseSourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetKeyFn =
  (
    {
      sourceId,
    }: {
      sourceId: string;
    },
    queryKey?: Array<unknown>
  ) => [
    useSourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetKey,
    ...(queryKey ?? [{ sourceId }]),
  ];
export type ConfigServiceGetLlmConfigsApiConfigLlmGetDefaultResponse = Awaited<
  ReturnType<typeof ConfigService.getLlmConfigsApiConfigLlmGet>
>;
export type ConfigServiceGetLlmConfigsApiConfigLlmGetQueryResult<
  TData = ConfigServiceGetLlmConfigsApiConfigLlmGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useConfigServiceGetLlmConfigsApiConfigLlmGetKey =
  'ConfigServiceGetLlmConfigsApiConfigLlmGet';
export const UseConfigServiceGetLlmConfigsApiConfigLlmGetKeyFn = (
  queryKey?: Array<unknown>
) => [useConfigServiceGetLlmConfigsApiConfigLlmGetKey, ...(queryKey ?? [])];
export type ConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetDefaultResponse =
  Awaited<
    ReturnType<typeof ConfigService.getEmbeddingConfigsApiConfigEmbeddingGet>
  >;
export type ConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetQueryResult<
  TData = ConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetDefaultResponse,
  TError = unknown
> = UseQueryResult<TData, TError>;
export const useConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetKey =
  'ConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGet';
export const UseConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetKeyFn = (
  queryKey?: Array<unknown>
) => [
  useConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetKey,
  ...(queryKey ?? []),
];
export type AuthServiceAuthenticateUserApiAuthPostMutationResult = Awaited<
  ReturnType<typeof AuthService.authenticateUserApiAuthPost>
>;
export type AdminServiceCreateUserAdminUsersPostMutationResult = Awaited<
  ReturnType<typeof AdminService.createUserAdminUsersPost>
>;
export type AdminServiceCreateNewApiKeyAdminUsersKeysPostMutationResult =
  Awaited<ReturnType<typeof AdminService.createNewApiKeyAdminUsersKeysPost>>;
export type ToolsServiceCreateToolAdminToolsPostMutationResult = Awaited<
  ReturnType<typeof ToolsService.createToolAdminToolsPost>
>;
export type ToolsServiceUpdateToolApiToolsToolIdPostMutationResult = Awaited<
  ReturnType<typeof ToolsService.updateToolApiToolsToolIdPost>
>;
export type ToolsServiceCreateToolApiToolsPostMutationResult = Awaited<
  ReturnType<typeof ToolsService.createToolApiToolsPost>
>;
export type AgentsServiceCreateAgentApiAgentsPostMutationResult = Awaited<
  ReturnType<typeof AgentsService.createAgentApiAgentsPost>
>;
export type AgentsServiceUpdateAgentApiAgentsAgentIdPostMutationResult =
  Awaited<ReturnType<typeof AgentsService.updateAgentApiAgentsAgentIdPost>>;
export type AgentsServiceUpdateAgentMemoryApiAgentsAgentIdMemoryPostMutationResult =
  Awaited<
    ReturnType<typeof AgentsService.updateAgentMemoryApiAgentsAgentIdMemoryPost>
  >;
export type AgentsServiceInsertAgentArchivalMemoryApiAgentsAgentIdArchivalPostMutationResult =
  Awaited<
    ReturnType<
      typeof AgentsService.insertAgentArchivalMemoryApiAgentsAgentIdArchivalPost
    >
  >;
export type AgentsServiceSendMessageApiAgentsAgentIdMessagesPostMutationResult =
  Awaited<
    ReturnType<typeof AgentsService.sendMessageApiAgentsAgentIdMessagesPost>
  >;
export type BlockServiceCreateBlockApiBlocksPostMutationResult = Awaited<
  ReturnType<typeof BlockService.createBlockApiBlocksPost>
>;
export type BlockServiceUpdateBlockApiBlocksBlockIdPostMutationResult = Awaited<
  ReturnType<typeof BlockService.updateBlockApiBlocksBlockIdPost>
>;
export type SourcesServiceUpdateSourceApiSourcesSourceIdPostMutationResult =
  Awaited<ReturnType<typeof SourcesService.updateSourceApiSourcesSourceIdPost>>;
export type SourcesServiceCreateSourceApiSourcesPostMutationResult = Awaited<
  ReturnType<typeof SourcesService.createSourceApiSourcesPost>
>;
export type SourcesServiceAttachSourceToAgentApiSourcesSourceIdAttachPostMutationResult =
  Awaited<
    ReturnType<
      typeof SourcesService.attachSourceToAgentApiSourcesSourceIdAttachPost
    >
  >;
export type SourcesServiceDetachSourceFromAgentApiSourcesSourceIdDetachPostMutationResult =
  Awaited<
    ReturnType<
      typeof SourcesService.detachSourceFromAgentApiSourcesSourceIdDetachPost
    >
  >;
export type SourcesServiceUploadFileToSourceApiSourcesSourceIdUploadPostMutationResult =
  Awaited<
    ReturnType<
      typeof SourcesService.uploadFileToSourceApiSourcesSourceIdUploadPost
    >
  >;
export type AdminServiceDeleteUserAdminUsersDeleteMutationResult = Awaited<
  ReturnType<typeof AdminService.deleteUserAdminUsersDelete>
>;
export type AdminServiceDeleteApiKeyAdminUsersKeysDeleteMutationResult =
  Awaited<ReturnType<typeof AdminService.deleteApiKeyAdminUsersKeysDelete>>;
export type ToolsServiceDeleteToolAdminToolsToolNameDeleteMutationResult =
  Awaited<ReturnType<typeof ToolsService.deleteToolAdminToolsToolNameDelete>>;
export type ToolsServiceDeleteToolApiToolsToolIdDeleteMutationResult = Awaited<
  ReturnType<typeof ToolsService.deleteToolApiToolsToolIdDelete>
>;
export type AgentsServiceDeleteAgentApiAgentsAgentIdDeleteMutationResult =
  Awaited<ReturnType<typeof AgentsService.deleteAgentApiAgentsAgentIdDelete>>;
export type AgentsServiceDeleteAgentArchivalMemoryApiAgentsAgentIdArchivalMemoryIdDeleteMutationResult =
  Awaited<
    ReturnType<
      typeof AgentsService.deleteAgentArchivalMemoryApiAgentsAgentIdArchivalMemoryIdDelete
    >
  >;
export type BlockServiceDeleteBlockApiBlocksBlockIdDeleteMutationResult =
  Awaited<ReturnType<typeof BlockService.deleteBlockApiBlocksBlockIdDelete>>;
export type SourcesServiceDeleteSourceApiSourcesSourceIdDeleteMutationResult =
  Awaited<
    ReturnType<typeof SourcesService.deleteSourceApiSourcesSourceIdDelete>
  >;

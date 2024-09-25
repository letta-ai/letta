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
  JobsService,
  LlmsService,
  ModelsService,
  OrganizationService,
  SourcesService,
  ToolsService,
  UsersService,
} from '../requests/services.gen';
import {
  APIKeyCreate,
  AuthRequest,
  Body_upload_file_to_source,
  CreateAgent,
  CreateArchivalMemory,
  CreateBlock,
  LettaRequest,
  OrganizationCreate,
  SourceCreate,
  SourceUpdate,
  ToolCreate,
  ToolUpdate,
  UpdateAgentState,
  UpdateBlock,
  UpdateMessage,
  UserCreate,
} from '../requests/types.gen';
import * as Common from './common';
export const useToolsServiceGetTool = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolKeyFn({ toolId }, queryKey),
    queryFn: () => ToolsService.getTool({ toolId }) as TData,
    ...options,
  });
export const useToolsServiceGetToolIdByName = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceGetToolIdByNameKeyFn(
      { toolName },
      queryKey
    ),
    queryFn: () => ToolsService.getToolIdByName({ toolName }) as TData,
    ...options,
  });
export const useToolsServiceListTools = <
  TData = Common.ToolsServiceListToolsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseToolsServiceListToolsKeyFn(queryKey),
    queryFn: () => ToolsService.listTools() as TData,
    ...options,
  });
export const useSourcesServiceGetSource = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceKeyFn({ sourceId }, queryKey),
    queryFn: () => SourcesService.getSource({ sourceId }) as TData,
    ...options,
  });
export const useSourcesServiceGetSourceIdByName = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn(
      { sourceName },
      queryKey
    ),
    queryFn: () => SourcesService.getSourceIdByName({ sourceName }) as TData,
    ...options,
  });
export const useSourcesServiceListSources = <
  TData = Common.SourcesServiceListSourcesDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn(queryKey),
    queryFn: () => SourcesService.listSources() as TData,
    ...options,
  });
export const useSourcesServiceListSourcePassages = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn(
      { sourceId },
      queryKey
    ),
    queryFn: () => SourcesService.listSourcePassages({ sourceId }) as TData,
    ...options,
  });
export const useSourcesServiceListSourceDocuments = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseSourcesServiceListSourceDocumentsKeyFn(
      { sourceId },
      queryKey
    ),
    queryFn: () => SourcesService.listSourceDocuments({ sourceId }) as TData,
    ...options,
  });
export const useAgentsServiceListAgents = <
  TData = Common.AgentsServiceListAgentsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn(queryKey),
    queryFn: () => AgentsService.listAgents() as TData,
    ...options,
  });
export const useAgentsServiceGetAgent = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseAgentsServiceGetAgentKeyFn({ agentId }, queryKey),
    queryFn: () => AgentsService.getAgent({ agentId }) as TData,
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
export const useAgentsServiceListAgentMessages = <
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
  useQuery<TData, TError>({
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
  }: {
    label?: string;
    name?: string;
    templatesOnly?: boolean;
  } = {},
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceListMemoryBlocksKeyFn(
      { label, name, templatesOnly },
      queryKey
    ),
    queryFn: () =>
      BlocksService.listMemoryBlocks({ label, name, templatesOnly }) as TData,
    ...options,
  });
export const useBlocksServiceGetMemoryBlock = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseBlocksServiceGetMemoryBlockKeyFn({ blockId }, queryKey),
    queryFn: () => BlocksService.getMemoryBlock({ blockId }) as TData,
    ...options,
  });
export const useJobsServiceListJobs = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListJobsKeyFn({ sourceId }, queryKey),
    queryFn: () => JobsService.listJobs({ sourceId }) as TData,
    ...options,
  });
export const useJobsServiceListActiveJobs = <
  TData = Common.JobsServiceListActiveJobsDefaultResponse,
  TError = unknown,
  TQueryKey extends Array<unknown> = unknown[]
>(
  queryKey?: TQueryKey,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) =>
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn(queryKey),
    queryFn: () => JobsService.listActiveJobs() as TData,
    ...options,
  });
export const useJobsServiceGetJob = <
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
  useQuery<TData, TError>({
    queryKey: Common.UseJobsServiceGetJobKeyFn({ jobId }, queryKey),
    queryFn: () => JobsService.getJob({ jobId }) as TData,
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
        update?: boolean;
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
      update?: boolean;
    },
    TContext
  >({
    mutationFn: ({ requestBody, update }) =>
      ToolsService.createTool({
        requestBody,
        update,
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
      SourcesService.createSource({ requestBody }) as unknown as Promise<TData>,
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
      SourcesService.attachAgentToSource({
        agentId,
        sourceId,
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
      SourcesService.detachAgentFromSource({
        agentId,
        sourceId,
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
    },
    TContext
  >({
    mutationFn: ({ formData, sourceId }) =>
      SourcesService.uploadFileToSource({
        formData,
        sourceId,
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
      AgentsService.createAgent({ requestBody }) as unknown as Promise<TData>,
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
      AgentsService.createAgentArchivalMemory({
        agentId,
        requestBody,
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
    },
    TContext
  >({
    mutationFn: ({ agentId, requestBody }) =>
      AgentsService.createAgentMessage({
        agentId,
        requestBody,
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
      BlocksService.createMemoryBlock({
        requestBody,
      }) as unknown as Promise<TData>,
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
      ToolsService.updateTool({
        requestBody,
        toolId,
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
      SourcesService.updateSource({
        requestBody,
        sourceId,
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
      AgentsService.updateAgent({
        agentId,
        requestBody,
      }) as unknown as Promise<TData>,
    ...options,
  });
export const useAgentsServiceUpdateAgentMemory = <
  TData = Common.AgentsServiceUpdateAgentMemoryMutationResult,
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
      AgentsService.updateAgentMemory({
        agentId,
        requestBody,
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
      BlocksService.updateMemoryBlock({
        blockId,
        requestBody,
      }) as unknown as Promise<TData>,
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
      ToolsService.deleteTool({ toolId }) as unknown as Promise<TData>,
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
      SourcesService.deleteSource({ sourceId }) as unknown as Promise<TData>,
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
      AgentsService.deleteAgent({ agentId }) as unknown as Promise<TData>,
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
      AgentsService.deleteAgentArchivalMemory({
        agentId,
        memoryId,
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
      BlocksService.deleteMemoryBlock({ blockId }) as unknown as Promise<TData>,
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
export const useAdminServiceDeleteOrganization = <
  TData = Common.AdminServiceDeleteOrganizationMutationResult,
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
      AdminService.deleteOrganization({ orgId }) as unknown as Promise<TData>,
    ...options,
  });
export const useOrganizationServiceDeleteOrganization = <
  TData = Common.OrganizationServiceDeleteOrganizationMutationResult,
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
      OrganizationService.deleteOrganization({
        orgId,
      }) as unknown as Promise<TData>,
    ...options,
  });

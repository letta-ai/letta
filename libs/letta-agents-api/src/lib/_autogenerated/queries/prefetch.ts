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
  SourcesService,
  ToolsService,
  UsersService,
} from '../requests/services.gen';
import * as Common from './common';
export const prefetchUseToolsServiceGetTool = (
  queryClient: QueryClient,
  {
    toolId,
  }: {
    toolId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceGetToolKeyFn({ toolId }),
    queryFn: () => ToolsService.getTool({ toolId }),
  });
export const prefetchUseToolsServiceGetToolIdByName = (
  queryClient: QueryClient,
  {
    toolName,
    userId,
  }: {
    toolName: string;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceGetToolIdByNameKeyFn({ toolName, userId }),
    queryFn: () => ToolsService.getToolIdByName({ toolName, userId }),
  });
export const prefetchUseToolsServiceListTools = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListToolsKeyFn({ userId }),
    queryFn: () => ToolsService.listTools({ userId }),
  });
export const prefetchUseSourcesServiceGetSource = (
  queryClient: QueryClient,
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourceKeyFn({ sourceId, userId }),
    queryFn: () => SourcesService.getSource({ sourceId, userId }),
  });
export const prefetchUseSourcesServiceGetSourceIdByName = (
  queryClient: QueryClient,
  {
    sourceName,
    userId,
  }: {
    sourceName: string;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn({
      sourceName,
      userId,
    }),
    queryFn: () => SourcesService.getSourceIdByName({ sourceName, userId }),
  });
export const prefetchUseSourcesServiceListSources = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn({ userId }),
    queryFn: () => SourcesService.listSources({ userId }),
  });
export const prefetchUseSourcesServiceListSourcePassages = (
  queryClient: QueryClient,
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn({
      sourceId,
      userId,
    }),
    queryFn: () => SourcesService.listSourcePassages({ sourceId, userId }),
  });
export const prefetchUseSourcesServiceListSourceDocuments = (
  queryClient: QueryClient,
  {
    sourceId,
    userId,
  }: {
    sourceId: string;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourceDocumentsKeyFn({
      sourceId,
      userId,
    }),
    queryFn: () => SourcesService.listSourceDocuments({ sourceId, userId }),
  });
export const prefetchUseAgentsServiceListAgents = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn({ userId }),
    queryFn: () => AgentsService.listAgents({ userId }),
  });
export const prefetchUseAgentsServiceGetAgent = (
  queryClient: QueryClient,
  {
    agentId,
    userId,
  }: {
    agentId: string;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceGetAgentKeyFn({ agentId, userId }),
    queryFn: () => AgentsService.getAgent({ agentId, userId }),
  });
export const prefetchUseAgentsServiceGetAgentSources = (
  queryClient: QueryClient,
  {
    agentId,
  }: {
    agentId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceGetAgentSourcesKeyFn({ agentId }),
    queryFn: () => AgentsService.getAgentSources({ agentId }),
  });
export const prefetchUseAgentsServiceListAgentInContextMessages = (
  queryClient: QueryClient,
  {
    agentId,
  }: {
    agentId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentInContextMessagesKeyFn({
      agentId,
    }),
    queryFn: () => AgentsService.listAgentInContextMessages({ agentId }),
  });
export const prefetchUseAgentsServiceGetAgentMemory = (
  queryClient: QueryClient,
  {
    agentId,
  }: {
    agentId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceGetAgentMemoryKeyFn({ agentId }),
    queryFn: () => AgentsService.getAgentMemory({ agentId }),
  });
export const prefetchUseAgentsServiceGetAgentRecallMemorySummary = (
  queryClient: QueryClient,
  {
    agentId,
  }: {
    agentId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceGetAgentRecallMemorySummaryKeyFn({
      agentId,
    }),
    queryFn: () => AgentsService.getAgentRecallMemorySummary({ agentId }),
  });
export const prefetchUseAgentsServiceGetAgentArchivalMemorySummary = (
  queryClient: QueryClient,
  {
    agentId,
  }: {
    agentId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceGetAgentArchivalMemorySummaryKeyFn({
      agentId,
    }),
    queryFn: () => AgentsService.getAgentArchivalMemorySummary({ agentId }),
  });
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
  }
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
export const prefetchUseAgentsServiceListAgentMessages = (
  queryClient: QueryClient,
  {
    agentId,
    assistantMessageFunctionKwarg,
    assistantMessageFunctionName,
    before,
    limit,
    msgObject,
    useAssistantMessage,
    userId,
  }: {
    agentId: string;
    assistantMessageFunctionKwarg?: string;
    assistantMessageFunctionName?: string;
    before?: string;
    limit?: number;
    msgObject?: boolean;
    useAssistantMessage?: boolean;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentMessagesKeyFn({
      agentId,
      assistantMessageFunctionKwarg,
      assistantMessageFunctionName,
      before,
      limit,
      msgObject,
      useAssistantMessage,
      userId,
    }),
    queryFn: () =>
      AgentsService.listAgentMessages({
        agentId,
        assistantMessageFunctionKwarg,
        assistantMessageFunctionName,
        before,
        limit,
        msgObject,
        useAssistantMessage,
        userId,
      }),
  });
export const prefetchUseModelsServiceListModels = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListModelsKeyFn(),
    queryFn: () => ModelsService.listModels(),
  });
export const prefetchUseModelsServiceListEmbeddingModels = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListEmbeddingModelsKeyFn(),
    queryFn: () => ModelsService.listEmbeddingModels(),
  });
export const prefetchUseLlmsServiceListModels = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseLlmsServiceListModelsKeyFn(),
    queryFn: () => LlmsService.listModels(),
  });
export const prefetchUseLlmsServiceListEmbeddingModels = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseLlmsServiceListEmbeddingModelsKeyFn(),
    queryFn: () => LlmsService.listEmbeddingModels(),
  });
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
  } = {}
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
export const prefetchUseBlocksServiceGetMemoryBlock = (
  queryClient: QueryClient,
  {
    blockId,
  }: {
    blockId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceGetMemoryBlockKeyFn({ blockId }),
    queryFn: () => BlocksService.getMemoryBlock({ blockId }),
  });
export const prefetchUseJobsServiceListJobs = (
  queryClient: QueryClient,
  {
    sourceId,
    userId,
  }: {
    sourceId?: string;
    userId?: string;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListJobsKeyFn({ sourceId, userId }),
    queryFn: () => JobsService.listJobs({ sourceId, userId }),
  });
export const prefetchUseJobsServiceListActiveJobs = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId?: string;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn({ userId }),
    queryFn: () => JobsService.listActiveJobs({ userId }),
  });
export const prefetchUseJobsServiceGetJob = (
  queryClient: QueryClient,
  {
    jobId,
  }: {
    jobId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceGetJobKeyFn({ jobId }),
    queryFn: () => JobsService.getJob({ jobId }),
  });
export const prefetchUseHealthServiceHealthCheck = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseHealthServiceHealthCheckKeyFn(),
    queryFn: () => HealthService.healthCheck(),
  });
export const prefetchUseUsersServiceListUsers = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseUsersServiceListUsersKeyFn({ cursor, limit }),
    queryFn: () => UsersService.listUsers({ cursor, limit }),
  });
export const prefetchUseUsersServiceListApiKeys = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseUsersServiceListApiKeysKeyFn({ userId }),
    queryFn: () => UsersService.listApiKeys({ userId }),
  });
export const prefetchUseAdminServiceListUsers = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListUsersKeyFn({ cursor, limit }),
    queryFn: () => AdminService.listUsers({ cursor, limit }),
  });
export const prefetchUseAdminServiceListApiKeys = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListApiKeysKeyFn({ userId }),
    queryFn: () => AdminService.listApiKeys({ userId }),
  });
export const prefetchUseAdminServiceListOrgs = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceListOrgsKeyFn({ cursor, limit }),
    queryFn: () => AdminService.listOrgs({ cursor, limit }),
  });
export const prefetchUseOrganizationServiceListOrgs = (
  queryClient: QueryClient,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseOrganizationServiceListOrgsKeyFn({ cursor, limit }),
    queryFn: () => OrganizationService.listOrgs({ cursor, limit }),
  });

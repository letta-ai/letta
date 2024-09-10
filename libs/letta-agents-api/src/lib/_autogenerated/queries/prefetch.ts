// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { type QueryClient } from '@tanstack/react-query';
import {
  AdminService,
  AgentsService,
  BlocksService,
  JobsService,
  LlmsService,
  ModelsService,
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
  }: {
    toolName: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceGetToolIdByNameKeyFn({ toolName }),
    queryFn: () => ToolsService.getToolIdByName({ toolName }),
  });
export const prefetchUseToolsServiceListTools = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListToolsKeyFn(),
    queryFn: () => ToolsService.listTools(),
  });
export const prefetchUseSourcesServiceGetSource = (
  queryClient: QueryClient,
  {
    sourceId,
  }: {
    sourceId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourceKeyFn({ sourceId }),
    queryFn: () => SourcesService.getSource({ sourceId }),
  });
export const prefetchUseSourcesServiceGetSourceIdByName = (
  queryClient: QueryClient,
  {
    sourceName,
  }: {
    sourceName: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourceIdByNameKeyFn({ sourceName }),
    queryFn: () => SourcesService.getSourceIdByName({ sourceName }),
  });
export const prefetchUseSourcesServiceListSources = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcesKeyFn(),
    queryFn: () => SourcesService.listSources(),
  });
export const prefetchUseSourcesServiceListSourcePassages = (
  queryClient: QueryClient,
  {
    sourceId,
  }: {
    sourceId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcePassagesKeyFn({ sourceId }),
    queryFn: () => SourcesService.listSourcePassages({ sourceId }),
  });
export const prefetchUseSourcesServiceListSourceDocuments = (
  queryClient: QueryClient,
  {
    sourceId,
  }: {
    sourceId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourceDocumentsKeyFn({ sourceId }),
    queryFn: () => SourcesService.listSourceDocuments({ sourceId }),
  });
export const prefetchUseAgentsServiceListAgents = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn(),
    queryFn: () => AgentsService.listAgents(),
  });
export const prefetchUseAgentsServiceGetAgent = (
  queryClient: QueryClient,
  {
    agentId,
  }: {
    agentId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceGetAgentKeyFn({ agentId }),
    queryFn: () => AgentsService.getAgent({ agentId }),
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
  }: {
    after?: number;
    agentId: string;
    before?: number;
    limit?: number;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentArchivalMemoryKeyFn({
      after,
      agentId,
      before,
      limit,
    }),
    queryFn: () =>
      AgentsService.listAgentArchivalMemory({ after, agentId, before, limit }),
  });
export const prefetchUseAgentsServiceListAgentMessages = (
  queryClient: QueryClient,
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
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentMessagesKeyFn({
      agentId,
      before,
      limit,
      msgObject,
    }),
    queryFn: () =>
      AgentsService.listAgentMessages({ agentId, before, limit, msgObject }),
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
  }: {
    label?: string;
    name?: string;
    templatesOnly?: boolean;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceListMemoryBlocksKeyFn({
      label,
      name,
      templatesOnly,
    }),
    queryFn: () =>
      BlocksService.listMemoryBlocks({ label, name, templatesOnly }),
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
export const prefetchUseJobsServiceListJobs = (queryClient: QueryClient) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListJobsKeyFn(),
    queryFn: () => JobsService.listJobs(),
  });
export const prefetchUseJobsServiceListActiveJobs = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListActiveJobsKeyFn(),
    queryFn: () => JobsService.listActiveJobs(),
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

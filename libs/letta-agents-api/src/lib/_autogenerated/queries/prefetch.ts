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
  SandboxConfigService,
  SourcesService,
  ToolsService,
  UsersService,
} from '../requests/services.gen';
import * as Common from './common';
export const prefetchUseToolsServiceGetTool = (
  queryClient: QueryClient,
  {
    toolId,
    userId,
  }: {
    toolId: string;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceGetToolKeyFn({ toolId, userId }),
    queryFn: () => ToolsService.getTool({ toolId, userId }),
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
    cursor,
    limit,
    userId,
  }: {
    cursor?: string;
    limit?: number;
    userId?: string;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListToolsKeyFn({ cursor, limit, userId }),
    queryFn: () => ToolsService.listTools({ cursor, limit, userId }),
  });
export const prefetchUseToolsServiceListComposioApps = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListComposioAppsKeyFn(),
    queryFn: () => ToolsService.listComposioApps(),
  });
export const prefetchUseToolsServiceListComposioActionsByApp = (
  queryClient: QueryClient,
  {
    composioAppName,
  }: {
    composioAppName: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListComposioActionsByAppKeyFn({
      composioAppName,
    }),
    queryFn: () => ToolsService.listComposioActionsByApp({ composioAppName }),
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
  }
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
export const prefetchUseAgentsServiceListAgents = (
  queryClient: QueryClient,
  {
    name,
    tags,
    userId,
  }: {
    name?: string;
    tags?: string[];
    userId?: string;
  } = {}
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentsKeyFn({ name, tags, userId }),
    queryFn: () => AgentsService.listAgents({ name, tags, userId }),
  });
export const prefetchUseAgentsServiceGetAgentContextWindow = (
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
    queryKey: Common.UseAgentsServiceGetAgentContextWindowKeyFn({
      agentId,
      userId,
    }),
    queryFn: () => AgentsService.getAgentContextWindow({ agentId, userId }),
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
export const prefetchUseAgentsServiceGetToolsFromAgent = (
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
    queryKey: Common.UseAgentsServiceGetToolsFromAgentKeyFn({
      agentId,
      userId,
    }),
    queryFn: () => AgentsService.getToolsFromAgent({ agentId, userId }),
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
  }
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
export const prefetchUseAgentsServiceGetAgentMemoryBlocks = (
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
    queryKey: Common.UseAgentsServiceGetAgentMemoryBlocksKeyFn({
      agentId,
      userId,
    }),
    queryFn: () => AgentsService.getAgentMemoryBlocks({ agentId, userId }),
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
  }
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
    userId,
  }: {
    blockId: string;
    userId?: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlocksServiceGetMemoryBlockKeyFn({ blockId, userId }),
    queryFn: () => BlocksService.getMemoryBlock({ blockId, userId }),
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
export const prefetchUseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGet =
  (
    queryClient: QueryClient,
    {
      cursor,
      limit,
      userId,
    }: {
      cursor?: string;
      limit?: number;
      userId?: string;
    } = {}
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxConfigsV1SandboxConfigGetKeyFn(
          { cursor, limit, userId }
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxConfigsV1SandboxConfigGet({
          cursor,
          limit,
          userId,
        }),
    });
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
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSandboxConfigServiceListSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGetKeyFn(
          { cursor, limit, sandboxConfigId, userId }
        ),
      queryFn: () =>
        SandboxConfigService.listSandboxEnvVarsV1SandboxConfigSandboxConfigIdEnvironmentVariableGet(
          { cursor, limit, sandboxConfigId, userId }
        ),
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

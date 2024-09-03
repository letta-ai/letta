// generated with @7nohe/openapi-react-query-codegen@1.6.0

import { type QueryClient } from '@tanstack/react-query';
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
export const prefetchUseAdminServiceGetAllUsersAdminUsersGet = (
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
    queryKey: Common.UseAdminServiceGetAllUsersAdminUsersGetKeyFn({
      cursor,
      limit,
    }),
    queryFn: () => AdminService.getAllUsersAdminUsersGet({ cursor, limit }),
  });
export const prefetchUseAdminServiceGetApiKeysAdminUsersKeysGet = (
  queryClient: QueryClient,
  {
    userId,
  }: {
    userId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAdminServiceGetApiKeysAdminUsersKeysGetKeyFn({
      userId,
    }),
    queryFn: () => AdminService.getApiKeysAdminUsersKeysGet({ userId }),
  });
export const prefetchUseToolsServiceGetToolAdminToolsToolNameGet = (
  queryClient: QueryClient,
  {
    toolName,
  }: {
    toolName: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceGetToolAdminToolsToolNameGetKeyFn({
      toolName,
    }),
    queryFn: () => ToolsService.getToolAdminToolsToolNameGet({ toolName }),
  });
export const prefetchUseToolsServiceListAllToolsAdminToolsGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListAllToolsAdminToolsGetKeyFn(),
    queryFn: () => ToolsService.listAllToolsAdminToolsGet(),
  });
export const prefetchUseToolsServiceGetToolApiToolsToolIdGet = (
  queryClient: QueryClient,
  {
    toolId,
  }: {
    toolId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceGetToolApiToolsToolIdGetKeyFn({ toolId }),
    queryFn: () => ToolsService.getToolApiToolsToolIdGet({ toolId }),
  });
export const prefetchUseToolsServiceGetToolIdApiToolsNameToolNameGet = (
  queryClient: QueryClient,
  {
    toolName,
  }: {
    toolName: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceGetToolIdApiToolsNameToolNameGetKeyFn({
      toolName,
    }),
    queryFn: () => ToolsService.getToolIdApiToolsNameToolNameGet({ toolName }),
  });
export const prefetchUseToolsServiceListAllToolsApiToolsGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseToolsServiceListAllToolsApiToolsGetKeyFn(),
    queryFn: () => ToolsService.listAllToolsApiToolsGet(),
  });
export const prefetchUseAgentsServiceGetAllAgentsApiAdminAgentsGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceGetAllAgentsApiAdminAgentsGetKeyFn(),
    queryFn: () => AgentsService.getAllAgentsApiAdminAgentsGet(),
  });
export const prefetchUseAgentsServiceListAgentsApiAgentsGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceListAgentsApiAgentsGetKeyFn(),
    queryFn: () => AgentsService.listAgentsApiAgentsGet(),
  });
export const prefetchUseAgentsServiceGetAgentStateApiAgentsAgentIdGet = (
  queryClient: QueryClient,
  {
    agentId,
  }: {
    agentId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
      agentId,
    }),
    queryFn: () => AgentsService.getAgentStateApiAgentsAgentIdGet({ agentId }),
  });
export const prefetchUseAgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGet =
  (
    queryClient: QueryClient,
    {
      agentId,
    }: {
      agentId: string;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseAgentsServiceGetAgentSourcesApiAgentsAgentIdSourcesGetKeyFn({
          agentId,
        }),
      queryFn: () =>
        AgentsService.getAgentSourcesApiAgentsAgentIdSourcesGet({ agentId }),
    });
export const prefetchUseAgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGet =
  (
    queryClient: QueryClient,
    {
      agentId,
    }: {
      agentId: string;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseAgentsServiceGetAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGetKeyFn(
          { agentId }
        ),
      queryFn: () =>
        AgentsService.getAgentInContextMessagesApiAgentsAgentIdMemoryMessagesGet(
          { agentId }
        ),
    });
export const prefetchUseAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGet = (
  queryClient: QueryClient,
  {
    agentId,
  }: {
    agentId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey:
      Common.UseAgentsServiceGetAgentMemoryApiAgentsAgentIdMemoryGetKeyFn({
        agentId,
      }),
    queryFn: () =>
      AgentsService.getAgentMemoryApiAgentsAgentIdMemoryGet({ agentId }),
  });
export const prefetchUseAgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGet =
  (
    queryClient: QueryClient,
    {
      agentId,
    }: {
      agentId: string;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseAgentsServiceGetAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGetKeyFn(
          { agentId }
        ),
      queryFn: () =>
        AgentsService.getAgentRecallMemorySummaryApiAgentsAgentIdMemoryRecallGet(
          { agentId }
        ),
    });
export const prefetchUseAgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGet =
  (
    queryClient: QueryClient,
    {
      agentId,
    }: {
      agentId: string;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseAgentsServiceGetAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGetKeyFn(
          { agentId }
        ),
      queryFn: () =>
        AgentsService.getAgentArchivalMemorySummaryApiAgentsAgentIdMemoryArchivalGet(
          { agentId }
        ),
    });
export const prefetchUseAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGet =
  (
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
      queryKey:
        Common.UseAgentsServiceGetAgentArchivalMemoryApiAgentsAgentIdArchivalGetKeyFn(
          { after, agentId, before, limit }
        ),
      queryFn: () =>
        AgentsService.getAgentArchivalMemoryApiAgentsAgentIdArchivalGet({
          after,
          agentId,
          before,
          limit,
        }),
    });
export const prefetchUseAgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGet =
  (
    queryClient: QueryClient,
    {
      agentId,
      count,
      start,
    }: {
      agentId: string;
      count: number;
      start: number;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseAgentsServiceGetAgentMessagesInContextApiAgentsAgentIdMessagesContextGetKeyFn(
          { agentId, count, start }
        ),
      queryFn: () =>
        AgentsService.getAgentMessagesInContextApiAgentsAgentIdMessagesContextGet(
          { agentId, count, start }
        ),
    });
export const prefetchUseAgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGet =
  (
    queryClient: QueryClient,
    {
      agentId,
      before,
      limit,
    }: {
      agentId: string;
      before?: string;
      limit?: number;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseAgentsServiceGetAgentMessagesApiAgentsAgentIdMessagesGetKeyFn(
          { agentId, before, limit }
        ),
      queryFn: () =>
        AgentsService.getAgentMessagesApiAgentsAgentIdMessagesGet({
          agentId,
          before,
          limit,
        }),
    });
export const prefetchUseBlockServiceListBlocksApiBlocksGet = (
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
    queryKey: Common.UseBlockServiceListBlocksApiBlocksGetKeyFn({
      label,
      name,
      templatesOnly,
    }),
    queryFn: () =>
      BlockService.listBlocksApiBlocksGet({ label, name, templatesOnly }),
  });
export const prefetchUseBlockServiceGetBlockApiBlocksBlockIdGet = (
  queryClient: QueryClient,
  {
    blockId,
  }: {
    blockId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseBlockServiceGetBlockApiBlocksBlockIdGetKeyFn({
      blockId,
    }),
    queryFn: () => BlockService.getBlockApiBlocksBlockIdGet({ blockId }),
  });
export const prefetchUseJobsServiceListJobsApiJobsGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListJobsApiJobsGetKeyFn(),
    queryFn: () => JobsService.listJobsApiJobsGet(),
  });
export const prefetchUseJobsServiceListActiveJobsApiJobsActiveGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceListActiveJobsApiJobsActiveGetKeyFn(),
    queryFn: () => JobsService.listActiveJobsApiJobsActiveGet(),
  });
export const prefetchUseJobsServiceGetJobApiJobsJobIdGet = (
  queryClient: QueryClient,
  {
    jobId,
  }: {
    jobId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseJobsServiceGetJobApiJobsJobIdGetKeyFn({ jobId }),
    queryFn: () => JobsService.getJobApiJobsJobIdGet({ jobId }),
  });
export const prefetchUseModelsServiceListModelsApiModelsGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseModelsServiceListModelsApiModelsGetKeyFn(),
    queryFn: () => ModelsService.listModelsApiModelsGet(),
  });
export const prefetchUseSourcesServiceGetSourceApiSourcesSourceIdGet = (
  queryClient: QueryClient,
  {
    sourceId,
  }: {
    sourceId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetSourceApiSourcesSourceIdGetKeyFn({
      sourceId,
    }),
    queryFn: () => SourcesService.getSourceApiSourcesSourceIdGet({ sourceId }),
  });
export const prefetchUseSourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGet =
  (
    queryClient: QueryClient,
    {
      sourceName,
    }: {
      sourceName: string;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSourcesServiceGetSourceIdByNameApiSourcesNameSourceNameGetKeyFn(
          { sourceName }
        ),
      queryFn: () =>
        SourcesService.getSourceIdByNameApiSourcesNameSourceNameGet({
          sourceName,
        }),
    });
export const prefetchUseSourcesServiceListSourcesApiSourcesGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceListSourcesApiSourcesGetKeyFn(),
    queryFn: () => SourcesService.listSourcesApiSourcesGet(),
  });
export const prefetchUseSourcesServiceGetJobApiSourcesStatusJobIdGet = (
  queryClient: QueryClient,
  {
    jobId,
  }: {
    jobId: string;
  }
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseSourcesServiceGetJobApiSourcesStatusJobIdGetKeyFn({
      jobId,
    }),
    queryFn: () => SourcesService.getJobApiSourcesStatusJobIdGet({ jobId }),
  });
export const prefetchUseSourcesServiceListPassagesApiSourcesSourceIdPassagesGet =
  (
    queryClient: QueryClient,
    {
      sourceId,
    }: {
      sourceId: string;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSourcesServiceListPassagesApiSourcesSourceIdPassagesGetKeyFn({
          sourceId,
        }),
      queryFn: () =>
        SourcesService.listPassagesApiSourcesSourceIdPassagesGet({ sourceId }),
    });
export const prefetchUseSourcesServiceListDocumentsApiSourcesSourceIdDocumentsGet =
  (
    queryClient: QueryClient,
    {
      sourceId,
    }: {
      sourceId: string;
    }
  ) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseSourcesServiceListDocumentsApiSourcesSourceIdDocumentsGetKeyFn(
          { sourceId }
        ),
      queryFn: () =>
        SourcesService.listDocumentsApiSourcesSourceIdDocumentsGet({
          sourceId,
        }),
    });
export const prefetchUseConfigServiceGetLlmConfigsApiConfigLlmGet = (
  queryClient: QueryClient
) =>
  queryClient.prefetchQuery({
    queryKey: Common.UseConfigServiceGetLlmConfigsApiConfigLlmGetKeyFn(),
    queryFn: () => ConfigService.getLlmConfigsApiConfigLlmGet(),
  });
export const prefetchUseConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGet =
  (queryClient: QueryClient) =>
    queryClient.prefetchQuery({
      queryKey:
        Common.UseConfigServiceGetEmbeddingConfigsApiConfigEmbeddingGetKeyFn(),
      queryFn: () => ConfigService.getEmbeddingConfigsApiConfigEmbeddingGet(),
    });

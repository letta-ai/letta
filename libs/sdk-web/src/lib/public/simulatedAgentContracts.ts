import { z } from 'zod';
import { initContract } from '@ts-rest/core';

const c = initContract();

const SimulatedAgentMetaData = z.object({
  name: z.string(),
  id: z.string(),
  agentId: z.string(),
  agentTemplateId: z.string(),
  deployedAgentTemplateId: z.string().nullable(),
  agentTemplateFullName: z.string(),
  agentTemplateName: z.string(),
  isCorrupted: z.boolean().nullable(),
});

const getDefaultSimulatedAgentContract = c.query({
  path: '/agent-templates/:agentTemplateId/simulated-agents/default',
  method: 'GET',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  responses: {
    200: SimulatedAgentMetaData,
    404: z.object({
      message: z.string(),
    }),
  },
});

const createSimulatedAgentContract = c.mutation({
  path: '/simulated-agents',
  method: 'POST',
  body: z.object({
    agentTemplateId: z.string(),
    isDefault: z.boolean(),
    deployedAgentTemplateId: z.string().nullable().optional(),
    memoryVariables: z.record(z.string()).optional(),
  }),
  responses: {
    200: SimulatedAgentMetaData,
    201: SimulatedAgentMetaData,
    400: z.object({
      message: z.string(),
    }),
    500: z.object({
      message: z.string(),
    }),
  },
});

const deleteSimulatedAgentContract = c.mutation({
  path: '/simulated-agents/:simulatedAgentId',
  pathParams: z.object({
    simulatedAgentId: z.string(),
  }),
  body: z.undefined(),
  method: 'DELETE',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const flushSimulatedAgentContract = c.mutation({
  path: '/simulated-agents/:simulatedAgentId/flush',
  pathParams: z.object({
    simulatedAgentId: z.string(),
  }),
  body: z.undefined(),
  method: 'POST',
  responses: {
    200: SimulatedAgentMetaData,
    404: z.object({
      message: z.string(),
    }),
    500: z.object({
      message: z.string(),
    }),
  },
});

const refreshSimulatedSessionContract = c.mutation({
  path: '/simulated-agents/:simulatedAgentId/refresh',
  pathParams: z.object({
    simulatedAgentId: z.string(),
  }),
  body: z.undefined(),
  method: 'POST',
  responses: {
    200: SimulatedAgentMetaData,
    404: z.object({
      message: z.string(),
    }),
    500: z.object({
      message: z.string(),
    }),
  },
});

const getSimulatedAgentVariablesContract = c.query({
  path: '/simulated-agents/:simulatedAgentId/variables',
  method: 'GET',
  pathParams: z.object({
    simulatedAgentId: z.string(),
  }),
  responses: {
    200: z.object({
      memoryVariables: z.record(z.string()),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

const updateSimulatedAgentVariablesContract = c.mutation({
  path: '/simulated-agents/:simulatedAgentId/variables',
  method: 'PUT',
  pathParams: z.object({
    simulatedAgentId: z.string(),
  }),
  body: z.object({
    memoryVariables: z.record(z.string()).optional(),
  }),
  responses: {
    200: z.object({
      memoryVariables: z.record(z.string()),
    }),
    404: z.object({
      message: z.string(),
    }),
    500: z.object({
      message: z.string(),
    }),
  },
});

const ListSimulatedAgentsQuerySchema = z.object({
  agentTemplateId: z.string().optional(),
  deployedAgentTemplateId: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().max(20).optional(),
});

const listSimulatedAgentsContract = c.query({
  path: '/simulated-agents',
  method: 'GET',
  query: ListSimulatedAgentsQuerySchema,
  responses: {
    200: z.object({
      agents: z.array(SimulatedAgentMetaData),
      hasMore: z.boolean(),
    }),
  },
});

export const simulatedAgentContracts = c.router({
  getDefaultSimulatedAgent: getDefaultSimulatedAgentContract,
  createSimulatedAgent: createSimulatedAgentContract,
  deleteSimulatedAgent: deleteSimulatedAgentContract,
  flushSimulatedAgent: flushSimulatedAgentContract,
  refreshSimulatedSession: refreshSimulatedSessionContract,
  getSimulatedAgentVariables: getSimulatedAgentVariablesContract,
  updateSimulatedAgentVariables: updateSimulatedAgentVariablesContract,
  listSimulatedAgents: listSimulatedAgentsContract,
});

export const simulatedAgentQueryClientKeys = {
  getDefaultSimulatedAgent: (agentTemplateId: string) => [
    'simulated-agents',
    'default',
    agentTemplateId,
  ],
  createSimulatedAgent: (
    agentTemplateId: string,
    deployedAgentTemplateId?: string | null,
  ) => ['simulated-agents', 'create', agentTemplateId, deployedAgentTemplateId],
  deleteSimulatedAgent: (simulatedAgentId: string) => [
    'simulated-agents',
    simulatedAgentId,
  ],
  flushSimulatedAgent: (simulatedAgentId: string) => [
    'simulated-agents',
    simulatedAgentId,
    'flush',
  ],
  refreshSimulatedSession: (simulatedAgentId: string) => [
    'simulated-agents',
    simulatedAgentId,
    'refresh',
  ],
  getSimulatedAgentVariables: (simulatedAgentId: string) => [
    'simulated-agents',
    simulatedAgentId,
    'variables',
  ],
  updateSimulatedAgentVariables: (simulatedAgentId: string) => [
    'simulated-agents',
    simulatedAgentId,
    'variables',
    'update',
  ],
  listSimulatedAgents: (
    query: z.infer<typeof ListSimulatedAgentsQuerySchema>,
  ) => {
    return ['simulated-agents', query];
  },
};

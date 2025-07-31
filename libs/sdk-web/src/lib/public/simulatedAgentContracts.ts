import { z } from 'zod';
import { initContract } from '@ts-rest/core';

const c = initContract();

const SimulatedAgentMetaData = z.object({
  name: z.string(),
  id: z.string(),
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
  query: z.object({
    memoryVariables: z.record(z.string()),
    toolVariables: z.record(z.string()),
  }),
  responses: {
    200: SimulatedAgentMetaData,
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
  deleteSimulatedAgent: deleteSimulatedAgentContract,
  listSimulatedAgents: listSimulatedAgentsContract,
});

export const simulatedAgentQueryClientKeys = {
  getDefaultSimulatedAgent: (agentTemplateId: string) => [
    'simulated-agents',
    'default',
    agentTemplateId,
  ],
  deleteSimulatedAgent: (simulatedAgentId: string) => [
    'simulated-agents',
    simulatedAgentId,
  ],
  listSimulatedAgents: (
    query: z.infer<typeof ListSimulatedAgentsQuerySchema>,
  ) => {
    return ['simulated-agents', query];
  },
};

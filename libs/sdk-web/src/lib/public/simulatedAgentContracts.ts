import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { AgentTemplateSchemaResponseSchema } from '@letta-cloud/utils-shared';

const c = initContract();

const SimulatedAgentMetaData = z.object({
  name: z.string(),
  id: z.string(),
  agentId: z.string(),
  agentTemplateId: z.string(),
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

const syncDefaultSimulatedAgentContract = c.mutation({
  path: '/agent-templates/:agentTemplateId/simulated-agents/default/sync',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  body: z.undefined(),
  method: 'POST',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    404: z.object({
      message: z.string(),
    }),
    500: z.object({
      message: z.string(),
    }),
  },
});

// Type definitions for sync response
export const SyncDefaultSimulatedAgentResponseSchema = z.object({
  success: z.boolean(),
  updatedSchema: AgentTemplateSchemaResponseSchema.nullable(),
});

export type SyncDefaultSimulatedAgentResponse = z.infer<
  typeof SyncDefaultSimulatedAgentResponseSchema
>;

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


export const simulatedAgentContracts = c.router({
  getDefaultSimulatedAgent: getDefaultSimulatedAgentContract,
  flushSimulatedAgent: flushSimulatedAgentContract,
  refreshSimulatedSession: refreshSimulatedSessionContract,
  syncDefaultSimulatedAgent: syncDefaultSimulatedAgentContract,
  getSimulatedAgentVariables: getSimulatedAgentVariablesContract,
  updateSimulatedAgentVariables: updateSimulatedAgentVariablesContract,
});

export const simulatedAgentQueryClientKeys = {
  getDefaultSimulatedAgent: (agentTemplateId: string) => [
    'simulated-agents',
    'default',
    agentTemplateId,
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
  syncDefaultSimulatedAgent: (agentTemplateId: string) => [
    'simulated-agents',
    'default',
    agentTemplateId,
    'sync',
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
} as const;

export type SimulatedAgentQueryKeys = typeof simulatedAgentQueryClientKeys;

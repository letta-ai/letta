import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const AgentTemplateSchema = z.object({
  name: z.string(),
  id: z.string(),
  updatedAt: z.string(),
});

export const AgentTemplatesSchema = z.array(AgentTemplateSchema);

export type AgentTemplateType = z.infer<typeof AgentTemplateSchema>;

/* List Agent Templates */
export const ListAgentTemplatesResponseSchema = z.object({
  agentTemplates: AgentTemplatesSchema,
  hasNextPage: z.boolean(),
});

export type ListAgentTemplatesResponse = z.infer<
  typeof ListAgentTemplatesResponseSchema
>;

export const ListAgentTemplatesQuerySchema = z.object({
  limit: z.number().optional(),
  offset: z.number().optional(),
  search: z.string().optional(),
  projectId: z.string().optional(),
});

export type ListAgentTemplatesQuery = z.infer<
  typeof ListAgentTemplatesQuerySchema
>;

export const listAgentTemplatesContract = c.query({
  method: 'GET',
  path: '/agent-templates',
  query: ListAgentTemplatesQuerySchema,
  responses: {
    200: ListAgentTemplatesResponseSchema,
  },
});

export const agentTemplatesContracts = c.router({
  listAgentTemplates: listAgentTemplatesContract,
});

export const agentTemplatesQueryClientKeys = {
  listAgentTemplates: ['listAgentTemplates'],
  listAgentTemplatesWithSearch: (query: ListAgentTemplatesQuery) => [
    ...agentTemplatesQueryClientKeys.listAgentTemplates,
    query,
  ],
};

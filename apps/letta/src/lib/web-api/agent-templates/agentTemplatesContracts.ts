import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ProjectAgentTemplateSchema } from '$letta/web-api/projects/projectContracts';

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

/* Fork Testing Agent */
const ForkAgentTemplateParamsSchema = z.object({
  projectId: z.string(),
  agentTemplateId: z.string(),
});

const forkAgentTemplateContract = c.mutation({
  method: 'POST',
  path: '/projects/:projectId/testing-agents/:agentTemplateId/fork',
  pathParams: ForkAgentTemplateParamsSchema,
  body: z.undefined(),
  responses: {
    201: ProjectAgentTemplateSchema,
  },
});

export const agentTemplatesContracts = c.router({
  listAgentTemplates: listAgentTemplatesContract,
  forkAgentTemplate: forkAgentTemplateContract,
});

export const agentTemplatesQueryClientKeys = {
  listAgentTemplates: ['listAgentTemplates'],
  listAgentTemplatesWithSearch: (query: ListAgentTemplatesQuery) => [
    ...agentTemplatesQueryClientKeys.listAgentTemplates,
    query,
  ],
};

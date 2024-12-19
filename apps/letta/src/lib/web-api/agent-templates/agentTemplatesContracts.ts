import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ProjectAgentTemplateSchema } from '$letta/web-api/projects/projectContracts';
import type { AgentState } from '@letta-web/letta-agents-api';
import { VersionedTemplateType } from '$letta/types';

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

/* Get Agent Template Simulation Session */
const GetAgentTemplateSessionParamsSchema = z.object({
  projectId: z.string(),
  agentTemplateId: z.string(),
});

type GetAgentTemplateSessionParams = z.infer<
  typeof GetAgentTemplateSessionParamsSchema
>;

export const GetAgentTemplateSessionResponseSchema = c.type<{
  id: string;
  agentId: string;
  variables: Record<string, string>;
  agent: AgentState;
}>();

const getAgentTemplateSimulatorSessionContract = c.query({
  method: 'GET',
  path: '/projects/:projectId/testing-agents/:agentTemplateId/simulation-session',
  pathParams: GetAgentTemplateSessionParamsSchema,
  responses: {
    200: GetAgentTemplateSessionResponseSchema,
  },
});

export type GetAgentTemplateSimulatorSessionResponseBody = ServerInferResponses<
  typeof getAgentTemplateSimulatorSessionContract,
  200
>;

/* Create new Agent Template Session */
const CreateAgentTemplateSessionParamsSchema = z.object({
  projectId: z.string(),
  agentTemplateId: z.string(),
});

export const CreateAgentTemplateSessionResponseSchema = c.type<{
  id: string;
  agentId: string;
  variables: Record<string, string>;
  agent: AgentState;
}>();

export const CreateAgentTemplateSessionBodySchema = z.object({
  variables: z.record(z.string()),
});

const createAgentTemplateSimulatorSessionContract = c.mutation({
  method: 'POST',
  path: '/projects/:projectId/testing-agents/:agentTemplateId/simulation-session',
  pathParams: CreateAgentTemplateSessionParamsSchema,
  body: CreateAgentTemplateSessionBodySchema,
  responses: {
    201: CreateAgentTemplateSessionResponseSchema,
  },
});

/* Refresh Agent Template Session */
const RefreshAgentTemplateSessionParamsSchema = z.object({
  agentSessionId: z.string(),
  agentTemplateId: z.string(),
});

const refreshAgentTemplateSimulatorSessionContract = c.mutation({
  method: 'POST',
  path: '/templates/:agentTemplateId/simulation-session/:agentSessionId/refresh',
  pathParams: RefreshAgentTemplateSessionParamsSchema,
  body: z.undefined(),
  responses: {
    200: CreateAgentTemplateSessionResponseSchema,
  },
});

/*  Delete Agent Template Session */
const DeleteAgentTemplateSessionParamsSchema = z.object({
  agentSessionId: z.string(),
  agentTemplateId: z.string(),
});

const deleteAgentTemplateSimulatorSessionContract = c.mutation({
  method: 'DELETE',
  path: '/templates/:agentTemplateId/simulation-session/:agentSessionId',
  pathParams: DeleteAgentTemplateSessionParamsSchema,
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

const getAgentTemplateByVersionContract = c.query({
  method: 'GET',
  path: '/template-versions/:slug',
  pathParams: z.object({
    slug: z.string(),
  }),
  responses: {
    200: VersionedTemplateType,
  },
});

export const agentTemplatesContracts = c.router({
  listAgentTemplates: listAgentTemplatesContract,
  forkAgentTemplate: forkAgentTemplateContract,
  getAgentTemplateSimulatorSession: getAgentTemplateSimulatorSessionContract,
  createAgentTemplateSimulatorSession:
    createAgentTemplateSimulatorSessionContract,
  refreshAgentTemplateSimulatorSession:
    refreshAgentTemplateSimulatorSessionContract,
  deleteAgentTemplateSimulatorSession:
    deleteAgentTemplateSimulatorSessionContract,
  getAgentTemplateByVersion: getAgentTemplateByVersionContract,
});

export const agentTemplatesQueryClientKeys = {
  listAgentTemplates: ['listAgentTemplates'],
  listAgentTemplatesWithSearch: (query: ListAgentTemplatesQuery) => [
    ...agentTemplatesQueryClientKeys.listAgentTemplates,
    query,
  ],
  getAgentTemplateSession: (params: GetAgentTemplateSessionParams) => [
    'getAgentTemplateSession',
    params,
  ],
  getAgentTemplateByVersion: (slug: string) => [
    'getAgentTemplateByVersion',
    { slug },
  ],
};

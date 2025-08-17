import { initContract } from '@ts-rest/core';

import type {
  AgentState as AgentStateType,
  CreateAgentRequest,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@anatine/zod-openapi';
import { zodTypes } from '@letta-cloud/sdk-core';
import type {  ListAgentsData } from '@letta-cloud/sdk-core';

const { AgentState } = zodTypes;

extendZodWithOpenApi(z);

const c = initContract();

const CreateAgentResponseSchema = c.type<AgentStateType>();

const createAgentContract = c.mutation({
  method: 'POST',
  path: '/v1/agents',
  summary: 'Create Agent',
  description: 'Create a new agent with the specified configuration.',
  body: c.type<CreateAgentRequest>(),
  responses: {
    201: CreateAgentResponseSchema,
  },
});

/* Get Agent By Id */
const GetAgentByIdResponseSchema = c.type<AgentStateType>();

const getAgentByIdContract = c.query({
  method: 'GET',
  summary: 'Retrieve Agent',
  path: '/v1/agents/:agent_id',
  description: 'Get an agent by its ID',
  pathParams: z.object({
    agent_id: z.string(),
    include_relationships: z.array(z.string()).optional().nullable(),
  }),
  responses: {
    200: GetAgentByIdResponseSchema,
  },
});

/* Delete Agent */
const DeleteAgentResponseSchema = z.object({
  success: z.literal(true),
});

// @ts-expect-error - no body required
const deleteAgentContract = c.mutation({
  method: 'DELETE',
  summary: 'Delete Agent',
  path: '/v1/agents/:agent_id',
  description: 'Delete an agent by its ID',
  pathParams: z.object({
    agent_id: z.string(),
  }),
  responses: {
    200: DeleteAgentResponseSchema,
  },
});

/* Search Deployed Agents */
const SearchByAgentVersionSchema = z.object({
  field: z.literal('version'),
  value: z.string(),
});

const SearchByAgentName = z.object({
  field: z.literal('name'),
  operator: z.enum(['eq', 'contains']),
  value: z.string(),
});

const SearchByIdentitySchema = z.object({
  field: z.literal('identity'),
  operator: z.enum(['eq']),
  value: z.string(),
});

const SearchByAgentTag = z.object({
  field: z.literal('tags'),
  operator: z.enum(['contains']),
  value: z.string().array(),
});

const SearchByTemplateNameSchema = z.object({
  field: z.literal('templateName'),
  operator: z.enum(['eq', 'neq']),
  value: z.string(),
});

export const OrderByValuesEnum = z.enum(['created_at', 'updated_at']);

export type OrderByValuesEnumType = z.infer<typeof OrderByValuesEnum>;
//
// const OrderBySchema = z.object({
//   field: z.literal('order_by'),
//   value: OrderByValuesEnum,
//   direction: z.enum(['asc', 'desc']),
// });

export const SearchDeployedAgentsSchema = z.object({
  search: z
    .array(
      z.union([
        SearchByAgentVersionSchema,
        SearchByAgentName,
        SearchByAgentTag,
        SearchByIdentitySchema,
        SearchByTemplateNameSchema,
      ]),
    )
    .optional(),
  project_id: z.string().optional(),
  combinator: z.enum(['AND']).optional(),
  limit: z.number().optional(),
  after: z.string().optional().nullable(),
  sortBy: z.enum(['created_at', 'last_run_completion']).optional(),
  ascending: z.boolean().optional(),
});

const ExtendedAgentStateSchema = AgentState.extend({
  template: z.string().optional(),
});

export type ExtendedAgentState = z.infer<typeof ExtendedAgentStateSchema>;

const SearchDeployedAgentsResponseSchema = z.object({
  agents: z.array(ExtendedAgentStateSchema),
  nextCursor: z.string().optional().nullable(),
});

const searchDeployedAgentsContract = c.mutation({
  method: 'POST',
  summary: 'Search Deployed Agents',
  path: '/v1/agents/search',
  description: 'Search deployed agents',
  body: SearchDeployedAgentsSchema,
  responses: {
    200: SearchDeployedAgentsResponseSchema,
  },
});


/* get agent variables */
const GetAgentVariablesResponseSchema = z.object({
  variables: z.record(z.string()),
});

const GetAgentVariablesNotFoundResponseSchema = z.object({
  message: z.literal('Agent not found'),
});

const getAgentVariablesContract = c.query({
  method: 'GET',
  summary: 'Retrieve Memory Variables',
  path: '/v1/agents/:agent_id/core-memory/variables',
  description: 'Get the variables associated with an agent',
  pathParams: z.object({
    agent_id: z.string(),
  }),

  responses: {
    200: GetAgentVariablesResponseSchema,
    404: GetAgentVariablesNotFoundResponseSchema,
  },
});



/* migrate an agent to a new versioned agent template */
const MigrateAgentToNewVersionedAgentTemplateBodySchema = z.object({
  to_template: z.string(),
  preserve_core_memories: z.boolean(),
  preserve_tool_variables: z.boolean().optional().openapi({
    description:
      "If true, preserves the existing agent's tool environment variables instead of using the template's variables",
  }),
});

const MigrateAgentToNewVersionedAgentTemplateResponseSchema = z.object({
  success: z.literal(true),
});

const migrateAgentContract = c.mutation({
  method: 'POST',
  summary: 'Migrate Agent',
  path: '/v1/agents/:agent_id/migrate',
  description: 'Migrate an agent to a new versioned agent template. This will only work for "classic" and non-multiagent agent templates.',
  body: MigrateAgentToNewVersionedAgentTemplateBodySchema,
  pathParams: z.object({
    agent_id: z.string(),
  }),
  responses: {
    200: MigrateAgentToNewVersionedAgentTemplateResponseSchema,
  },
});

export const agentsContract = c.router({
  createAgent: createAgentContract,
  searchDeployedAgents: searchDeployedAgentsContract,
  getAgentById: getAgentByIdContract,
  deleteAgent: deleteAgentContract,
  migrateAgent: migrateAgentContract,
  getAgentVariables: getAgentVariablesContract,
});

export const agentsQueryKeys = {
  listAgentsWithSearch: (query: ListAgentsData) => ['agents', query],
  getAgentById: (agentId: string) => ['agents', agentId],
  searchDeployedAgents: (
    options: z.infer<typeof SearchDeployedAgentsSchema>,
  ) => ['agents', options],
  getAgentVariables: (agentId: string) => ['agents', agentId, 'variables'],
};

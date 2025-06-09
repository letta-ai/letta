import { initContract } from '@ts-rest/core';

import type {
  AgentState as AgentStateType,
  CreateAgentRequest,
} from '@letta-cloud/sdk-core';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@anatine/zod-openapi';
import { zodTypes } from '@letta-cloud/sdk-core';
import {
  type ListAgentsData,
  VersionedTemplateType,
} from '@letta-cloud/sdk-core';

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

/* deploy agent template */
const AgentNotFoundResponseSchema = z.object({
  message: z.literal('Agent not found'),
});

const FailedToDeployAgentTemplateErrorSchema = z.object({
  message: z.literal('Failed to version agent template'),
});

const versionAgentTemplateContract = c.mutation({
  method: 'POST',
  summary: 'Version Agent Template',
  path: '/v1/agents/:agent_id/version-template',
  description: 'Creates a versioned version of an agent',
  body: z.object({
    migrate_deployed_agents: z.boolean().optional(),
    message: z.string().max(140).optional(),
  }),
  query: z.object({
    returnAgentState: z.boolean().or(z.literal('true')).optional(),
  }),
  pathParams: z.object({
    agent_id: z.string().openapi({
      description:
        'The agent ID of the agent to migrate, if this agent is not a template, it will create a agent template from the agent provided as well',
    }),
  }),
  responses: {
    201: VersionedTemplateType,
    404: AgentNotFoundResponseSchema,
    500: FailedToDeployAgentTemplateErrorSchema,
  },
});

/* migrate an agent to a new versioned agent template */
const MigrateAgentToNewVersionedAgentTemplateBodySchema = z.object({
  to_template: z.string(),
  variables: z.record(z.string()).optional().openapi({
    description:
      'If you chose to not preserve core memories, you should provide the new variables for the core memories',
  }),
  preserve_core_memories: z.boolean(),
});

const MigrateAgentToNewVersionedAgentTemplateResponseSchema = z.object({
  success: z.literal(true),
});

const MigrateAgentToNewVersionedAgentTemplateNotFoundResponseSchema = z.object({
  message: z
    .literal(
      'Agent provided is a template or not found, you can only migrate deployed agents',
    )
    .or(z.literal('Template version provided does not exist')),
});

const MigrationFailedResponseSchema = z.object({
  message: z.literal('Migration failed'),
});

const MigrationFailedDueToProjectMismatchResponseSchema = z.object({
  message: z.literal(
    'You can only migrate agents to a new versioned agent template that belongs to the same project',
  ),
});

const migrateAgentContract = c.mutation({
  method: 'POST',
  summary: 'Migrate Agent',
  path: '/v1/agents/:agent_id/migrate',
  description: 'Migrate an agent to a new versioned agent template',
  body: MigrateAgentToNewVersionedAgentTemplateBodySchema,
  pathParams: z.object({
    agent_id: z.string(),
  }),
  responses: {
    200: MigrateAgentToNewVersionedAgentTemplateResponseSchema,
    404: MigrateAgentToNewVersionedAgentTemplateNotFoundResponseSchema,
    409: MigrationFailedDueToProjectMismatchResponseSchema,
    500: MigrationFailedResponseSchema,
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
      ]),
    )
    .optional(),
  project_id: z.string().optional(),
  combinator: z.enum(['AND']).optional(),
  limit: z.number().optional(),
  after: z.string().optional().nullable(),
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

const FailedToCreateAgentTemplateErrorSchema = z.object({
  message: z.literal('Failed to create agent template'),
});

const createTemplateFromAgentContract = c.mutation({
  method: 'POST',
  summary: 'Create Template From Agent',
  path: '/v1/agents/:agent_id/template',
  description: 'Create a template from an agent',
  pathParams: z.object({
    agent_id: z.string(),
  }),
  body: z.object({
    project: z.string().optional(),
  }),
  responses: {
    201: z.object({
      templateName: z.string(),
      templateId: z.string(),
    }),
    500: FailedToCreateAgentTemplateErrorSchema,
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

export const agentsContract = c.router({
  createAgent: createAgentContract,
  searchDeployedAgents: searchDeployedAgentsContract,
  versionAgentTemplate: versionAgentTemplateContract,
  migrateAgent: migrateAgentContract,
  getAgentById: getAgentByIdContract,
  deleteAgent: deleteAgentContract,
  createTemplateFromAgent: createTemplateFromAgentContract,
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

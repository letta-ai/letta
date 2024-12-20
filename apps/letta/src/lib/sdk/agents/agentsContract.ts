import { initContract } from '@ts-rest/core';
import type {
  AgentState,
  CreateAgentRequest,
  HTTPValidationError,
  UpdateAgent,
} from '@letta-web/letta-agents-api';
import {
  EmbeddingConfigSchema,
  LLMConfigSchema,
} from '@letta-web/letta-agents-api';
import { z } from 'zod';
import { MemoryBlocksSchema } from '$letta/sdk/types';
import { extendZodWithOpenApi } from '@anatine/zod-openapi';
import { VersionedTemplateType } from '$letta/types';

extendZodWithOpenApi(z);

const c = initContract();

/* Create Agent */
export interface CreateAgentBody extends CreateAgentRequest {
  /**
   * Make this Agent a template
   */
  template?: boolean;
  /**
   * Associate a project with this Agent (does not work when template_key is provided)
   */
  project_id?: string;
  /**
   * Create an agent based on a template_key
   */
  from_template?: string;

  variables?: Record<string, string>;
}

const CreateAgentBodySchema = z.object({
  description: z.string().nullable().optional().openapi({
    description: 'A description of the agent',
  }),
  metadata_: z.record(z.unknown()).nullable().optional(),
  user_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  message_ids: z.array(z.string()).nullable().optional().openapi({
    description: 'A list of message IDs associated with the agent',
  }),
  memory_blocks: MemoryBlocksSchema.nullable().optional(),
  tool_ids: z.string().array().nullable().optional(),
  system: z.string().nullable().optional(),
  llm_config: LLMConfigSchema.nullable()?.optional(),
  embedding_config: EmbeddingConfigSchema.nullable()?.optional(),

  // letta specific fields
  template: z.boolean().optional(),
  project_id: z.string().optional(),
  from_template: z.string().optional(),

  variables: z.record(z.string()).optional(),
});

const CreateAgentResponseSchema = c.type<AgentState>();

const CreateAgentResponseErrorSchema = c.type<HTTPValidationError>();

const CreateAgentResponse404ErrorSchema = z.object({
  message: z
    .literal('Template not found')
    .or(z.string())
    .or(z.literal('Project not found')),
});

const FailedToCreateAgentErrorSchema = z.object({
  message: z.literal('Failed to create agent'),
});

const UniqueIdentifierConflictResponseSchema = z.object({
  message: z.literal('An agent with the same name already exists'),
});

const createAgentContract = c.mutation({
  method: 'POST',
  path: '/v1/agents',
  summary: 'Create Agent',
  description: 'Create a new agent with the specified configuration.',
  body: CreateAgentBodySchema,
  responses: {
    201: CreateAgentResponseSchema,
    404: CreateAgentResponse404ErrorSchema,
    409: UniqueIdentifierConflictResponseSchema,
    422: CreateAgentResponseErrorSchema,
    500: FailedToCreateAgentErrorSchema,
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
  }),
  query: z.object({
    returnAgentState: z.boolean().optional(),
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
      'Agent provided is a template or not found, you can only migrate deployed agents'
    )
    .or(z.literal('Template version provided does not exist')),
});

const MigrationFailedResponseSchema = z.object({
  message: z.literal('Migration failed'),
});

const MigrationFailedDueToProjectMismatchResponseSchema = z.object({
  message: z.literal(
    'You can only migrate agents to a new versioned agent template that belongs to the same project'
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

interface ModifiedAgentState extends AgentState {
  version?: string;
}

/* List Agents */
const ListAgentsResponseSchema = c.type<ModifiedAgentState[]>();
const ListAgentsQuerySchema = z.object({
  template: z.boolean().optional(),
  include_version: z.boolean().optional(),
  project_id: z.string().optional(),
  by_version: z.string().optional(),
  name: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

type ListAgentsQuery = z.infer<typeof ListAgentsQuerySchema>;

const listAgentsContract = c.query({
  method: 'GET',
  summary: 'List Agents',
  path: '/v1/agents',
  description:
    'List all agents associated with a given user. This endpoint retrieves a list of all agents and their configurations associated with the specified user ID',
  query: ListAgentsQuerySchema,
  responses: {
    200: ListAgentsResponseSchema,
  },
});

/* Get Agent By Id */
const GetAgentByIdResponseSchema = c.type<AgentState>();

const GetAgentByIdNotFoundResponseSchema = z.object({
  message: z.literal('Agent not found'),
});

const getAgentByIdContract = c.query({
  method: 'GET',
  summary: 'Get Agent By Id',
  path: '/v1/agents/:agent_id',
  query: z.object({
    all: z.boolean().optional(),
  }),
  description: 'Get an agent by its ID',
  pathParams: z.object({
    agent_id: z.string(),
  }),
  responses: {
    200: GetAgentByIdResponseSchema,
    404: GetAgentByIdNotFoundResponseSchema,
  },
});

/* Delete Agent */
const DeleteAgentResponseSchema = z.object({
  success: z.literal(true),
});

const DeleteAgentNotFoundResponseSchema = z.object({
  message: z.literal('Agent not found'),
});

const DeleteAgentFailedResponseSchema = z.object({
  message: z.literal('Failed to delete agent'),
});

const deleteAgentContract = c.mutation({
  method: 'DELETE',
  summary: 'Delete Agent',
  path: '/v1/agents/:agent_id',
  description: 'Delete an agent by its ID',
  pathParams: z.object({
    agent_id: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: DeleteAgentResponseSchema,
    404: DeleteAgentNotFoundResponseSchema,
    500: DeleteAgentFailedResponseSchema,
  },
});

/* Update Agent */
const UpdateAgentBodySchema = c.type<UpdateAgent>();

const UpdateAgentResponseSchema = c.type<AgentState>();

const UpdateAgentNotFoundResponseSchema = z.object({
  message: z.literal('Agent not found'),
});

const UpdateAgentFailedNameNotAlphanumericResponseSchema = z.object({
  message: z.literal('Name must be alphanumeric, with underscores or dashes'),
});

const UpdateAgentFailedNameAlreadyExistsResponseSchema = z.object({
  message: z.literal('An agent with the same name already exists'),
});

const UpdateAgentFailedResponseSchema = z.object({
  message: z.literal('Failed to update agent'),
});

const updateAgentContract = c.mutation({
  method: 'PATCH',
  summary: 'Update Agent',
  path: '/v1/agents/:agent_id',
  description: 'Update an agent by its ID',
  body: UpdateAgentBodySchema,
  pathParams: z.object({
    agent_id: z.string(),
  }),
  responses: {
    200: UpdateAgentResponseSchema,
    400: UpdateAgentFailedNameNotAlphanumericResponseSchema,
    409: UpdateAgentFailedNameAlreadyExistsResponseSchema,
    404: UpdateAgentNotFoundResponseSchema,
    500: UpdateAgentFailedResponseSchema,
  },
});

/* Search Deployed Agents */
const SearchByAgentVersionSchema = z.object({
  field: z.literal('version'),
  value: z.string(),
});

const SearchByProjectIdSchema = z.object({
  field: z.literal('project_id'),
  value: z.string(),
  operator: z.enum(['eq', 'ne']),
});

export const OrderByValuesEnum = z.enum(['created_at', 'updated_at']);

export type OrderByValuesEnumType = z.infer<typeof OrderByValuesEnum>;

const OrderBySchema = z.object({
  field: z.literal('order_by'),
  value: OrderByValuesEnum,
  direction: z.enum(['asc', 'desc']),
});

const SearchDeployedAgentsSchema = z.object({
  search: z.array(
    z.union([
      SearchByAgentVersionSchema,
      SearchByProjectIdSchema,
      OrderBySchema,
    ])
  ),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const SearchDeployedAgentsResponseSchema = c.type<{
  agents: ModifiedAgentState[];
}>();

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
    project_id: z.string().optional(),
  }),
  responses: {
    201: CreateAgentResponseSchema,
    404: AgentNotFoundResponseSchema,
    500: FailedToCreateAgentTemplateErrorSchema,
  },
});

export const agentsContract = c.router({
  createAgent: createAgentContract,
  searchDeployedAgents: searchDeployedAgentsContract,
  versionAgentTemplate: versionAgentTemplateContract,
  migrateAgent: migrateAgentContract,
  listAgents: listAgentsContract,
  getAgentById: getAgentByIdContract,
  deleteAgent: deleteAgentContract,
  updateAgent: updateAgentContract,
  createTemplateFromAgent: createTemplateFromAgentContract,
});

export const agentsQueryKeys = {
  listAgentsWithSearch: (query: ListAgentsQuery) => ['agents', query],
  getAgentById: (agentId: string) => ['agents', agentId],
};

import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  AgentMessageSchema,
  AgentMessageTypeSchema,
} from '@letta-web/letta-agents-api';

const c = initContract();

const DeployedAgentResponseSchema = z.object({
  id: z.string(),
  sdkId: z.string(),
  uniqueIdentifier: z.string(),
  sourceAgentKey: z.string(),
  createdAt: z.string(),
});

const SimpleMessageSchema = z.object({
  text: z.string(),
  id: z.string(),
  created_at: z.string(),
  is_agent_message: z.boolean(),
});

export type SimpleMessage = z.infer<typeof SimpleMessageSchema>;

const ResponseMessageSchema = AgentMessageSchema;

/* Create Agent */
const CreateAgentBodySchema = z.object({
  sourceAgentKey: z.string(),
  uniqueIdentifier: z.string().optional(),
  // variables: z.record(z.string(), z.any()).optional(),
});

const CreateAgentResponseSchema = z.object({
  agentDeploymentId: z.string(),
});

const CreateAgentNotFoundResponseSchema = z.object({
  message: z.literal('Source agent not found'),
});

const UniqueIdentifierConflictResponseSchema = z.object({
  message: z.literal('An agent with the same unique identifier already exists'),
});

const createAgentContract = c.mutation({
  path: '/agents',
  summary: 'Create deployed agent',
  operationId: 'createDeployedAgent',
  method: 'POST',
  contentType: 'application/json',
  body: CreateAgentBodySchema,
  responses: {
    201: CreateAgentResponseSchema,
    404: CreateAgentNotFoundResponseSchema,
    409: UniqueIdentifierConflictResponseSchema,
  },
});

/* Chat With Agent */
export const ChatWithAgentBodySchema = z.object({
  message: z.string(),
  stream_tokens: z.boolean().optional(),
  return_message_types: AgentMessageTypeSchema.array().optional(),
  return_function_calls: z.string().array().optional(),
  format_function_call_arguments: z.boolean().optional(),
  // variables: z.record(z.string(), z.any()).optional(),
});

export type ChatWithAgentBodySchemaType = z.infer<
  typeof ChatWithAgentBodySchema
>;

export const ChatWithAgentParamsSchema = z.object({
  agentDeploymentId: z.string(),
});

const ChatWithAgentResponseSchema = z.object({
  messages: z.array(ResponseMessageSchema),
});

const ChatWithAgentNotFoundResponseSchema = z.object({
  message: z.literal('Agent not found'),
});

const chatWithAgentContract = c.mutation({
  path: '/agents/:agentDeploymentId/chat',
  summary: 'Chat with deployed agent',
  operationId: 'chatWithDeployedAgent',
  method: 'POST',
  pathParams: ChatWithAgentParamsSchema,
  contentType: 'application/json',
  body: ChatWithAgentBodySchema,
  responses: {
    201: ChatWithAgentResponseSchema,
    404: ChatWithAgentNotFoundResponseSchema,
  },
});

/* Get Deployed agent SDK ID */
const GetDeployedAgentSdkIdParamsSchema = z.object({
  agentDeploymentId: z.string(),
});

const GetDeployedAgentSdkIdResponseSchema = z.object({
  sdkId: z.string(),
});

const getDeployedAgentSdkIdContract = c.query({
  path: '/agents/:agentDeploymentId/sdk-id',
  summary: 'Get deployed agent SDK ID',
  operationId: 'getDeployedAgentSdkId',
  method: 'GET',
  pathParams: GetDeployedAgentSdkIdParamsSchema,
  responses: {
    200: GetDeployedAgentSdkIdResponseSchema,
    404: ChatWithAgentNotFoundResponseSchema,
  },
});

/* Migrate Deployed Agent to New Source Agent */
const MigrateDeployedAgentToNewSourceAgentBodySchema = z.object({
  sourceAgentKey: z.string(),
  preserveCoreMemories: z.boolean().optional(),
});

const MigrateDeployedAgentToNewSourceAgentParamsSchema = z.object({
  agentDeploymentId: z.string(),
});

const MigrateDeployedAgentToNewSourceAgentResponseSchema = z.object({
  agentDeploymentId: z.string(),
});

const MigrateDeployedAgentToNewSourceAgentNotFoundResponseSchema = z.object({
  message: z
    .literal('Source agent not found')
    .or(z.literal('Deployed Agent not found')),
});

const migrateDeployedAgentToNewSourceAgentContract = c.mutation({
  path: '/agents/:agentDeploymentId',
  summary: 'Migrate deployed agent to new source agent',
  description:
    "Migrate your deployed agent to a new source agent. This will overwrite the current agent's datasources, tools, and core memories. Archival and messages will be preserved.",
  operationId: 'migrateDeployedAgentToNewSourceAgent',
  method: 'POST',
  contentType: 'application/json',
  pathParams: MigrateDeployedAgentToNewSourceAgentParamsSchema,
  body: MigrateDeployedAgentToNewSourceAgentBodySchema,
  responses: {
    200: MigrateDeployedAgentToNewSourceAgentResponseSchema,
    404: MigrateDeployedAgentToNewSourceAgentNotFoundResponseSchema,
  },
});

/* Get Existing Messages from Deployed Agent */
const GetExistingMessagesFromDeployedAgentParamsSchema = z.object({
  agentDeploymentId: z.string(),
});

const GetExistingMessagesFromDeployedAgentResponseSchema = z.object({
  messages: z.array(ResponseMessageSchema),
});

const GetExistingMessagesFromDeployedAgentQuerySchema = z.object({
  return_message_types: AgentMessageTypeSchema.array().optional(),
  return_function_calls: z.string().array().optional(),
  format_function_call_arguments: z.boolean().optional(),
  format_user_message_arguments: z.boolean().optional(),
  before: z.string().optional(),
  limit: z.number().optional(),
});

const GetExistingMessagesFromDeployedAgentNotFoundResponseSchema = z.object({
  message: z.literal('Agent not found'),
});

const getExistingMessagesFromAgentContract = c.query({
  path: '/agents/:agentDeploymentId/messages',
  query: GetExistingMessagesFromDeployedAgentQuerySchema,
  summary: 'Get existing messages from deployed agent',
  operationId: 'getExistingMessagesFromDeployedAgent',
  method: 'GET',
  pathParams: GetExistingMessagesFromDeployedAgentParamsSchema,
  responses: {
    200: GetExistingMessagesFromDeployedAgentResponseSchema,
    404: GetExistingMessagesFromDeployedAgentNotFoundResponseSchema,
  },
});

/* Query Deployed Agents */
const QueryDeployedAgentsQuerySchema = z.object({
  uniqueIdentifier: z.string().optional(),
  projectId: z.string().optional(),
  sourceAgentKey: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

const QueryDeployedAgentsResponseSchema = z.object({
  deployedAgents: z.array(DeployedAgentResponseSchema),
});

const queryDeployedAgentsContract = c.query({
  path: '/agents',
  query: QueryDeployedAgentsQuerySchema,
  summary: 'Query deployed agents',
  operationId: 'queryDeployedAgents',
  method: 'GET',
  responses: {
    200: QueryDeployedAgentsResponseSchema,
  },
});

export const deploymentContracts = c.router({
  createAgent: createAgentContract,
  chatWithAgent: chatWithAgentContract,
  getDeployedAgentSdkId: getDeployedAgentSdkIdContract,
  migrateDeployedAgentToNewSourceAgent:
    migrateDeployedAgentToNewSourceAgentContract,
  getExistingMessagesFromAgent: getExistingMessagesFromAgentContract,
  queryDeployedAgents: queryDeployedAgentsContract,
});

import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

/* Create Agent */
const CreateAgentBodySchema = z.object({
  sourceAgentKey: z.string(),
  name: z.string().optional(),
  // variables: z.record(z.string(), z.any()).optional(),
});

const CreateAgentResponseSchema = z.object({
  agentDeploymentId: z.string(),
});

const CreateAgentNotFoundResponseSchema = z.object({
  message: z.literal('Source agent not found'),
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
  },
});

/* Chat With Agent */
export const ChatWithAgentBodySchema = z.object({
  message: z.string(),
  stream: z.boolean().optional(),
  // variables: z.record(z.string(), z.any()).optional(),
});

export const ChatWithAgentParamsSchema = z.object({
  agentDeploymentId: z.string(),
});

const ChatWithAgentResponseSchema = z.object({
  messages: z.array(
    z.object({
      role: z.string(),
      text: z.string(),
    })
  ),
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

export const deploymentContracts = c.router({
  createAgent: createAgentContract,
  chatWithAgent: chatWithAgentContract,
  getDeployedAgentSdkId: getDeployedAgentSdkIdContract,
  migrateDeployedAgentToNewSourceAgent:
    migrateDeployedAgentToNewSourceAgentContract,
});

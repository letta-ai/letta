import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

/* Create Agent */
const CreateAgentBodySchema = z.object({
  sourceAgentKey: z.string(),
  name: z.string().optional(),
  variables: z.record(z.string(), z.any()).optional(),
});

const CreateAgentResponseSchema = z.object({
  deployedAgentId: z.string(),
});

const CreateAgentNotFoundResponseSchema = z.object({
  message: z.literal('Source agent not found'),
});

const createAgentContract = c.mutation({
  path: '/agents',
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
  variables: z.record(z.string(), z.any()).optional(),
});

export const ChatWithAgentParamsSchema = z.object({
  deployedAgentId: z.string(),
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
  path: '/agents/:deployedAgentId/chat',
  method: 'POST',
  pathParams: ChatWithAgentParamsSchema,
  contentType: 'application/json',
  body: ChatWithAgentBodySchema,
  responses: {
    201: ChatWithAgentResponseSchema,
    404: ChatWithAgentNotFoundResponseSchema,
  },
});

export const agentsContracts = c.router({
  createAgent: createAgentContract,
  chatWithAgent: chatWithAgentContract,
});

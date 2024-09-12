import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

/* Create Agent */
const CreateAgentBodySchema = z.object({
  sourceAgentId: z.string(),
  name: z.string().optional(),
  variables: z.record(z.string(), z.any()),
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
const ChatWithAgentBodySchema = z.object({
  message: z.string(),
  variables: z.record(z.string(), z.any()),
});

const ChatWithAgentResponseSchema = z.object({
  message: z.string(),
});

const ChatWithAgentNotFoundResponseSchema = z.object({
  message: z.literal('Agent not found'),
});

const chatWithAgentContract = c.mutation({
  path: '/agents/:deployedAgentId/chat',
  method: 'POST',
  pathParams: z.object({
    deployedAgentId: z.string(),
  }),
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

import { z } from 'zod';
import { initContract } from '@ts-rest/core';

const c = initContract();

const CreatedAgentFromStarterKitSchema = z.object({
  agentId: z.string(),
  projectSlug: z.string(),
});

const CreateAgentFromStarterKitBodySchema = z.object({
  projectId: z.string().optional(),
  name: z.string().optional(),
  agentType: z.string().optional(),
});

const createAgentFromStarterKitContract = c.mutation({
  method: 'POST',
  path: '/starter-kits/:starterKitId/agents',
  body: CreateAgentFromStarterKitBodySchema,
  pathParams: z.object({
    starterKitId: z.string(),
  }),
  responses: {
    201: CreatedAgentFromStarterKitSchema,
  },
});

const CreatedTemplateFromStarterKitSchema = z.object({
  templateName: z.string(),
  projectSlug: z.string(),
});

const CreateTemplateFromStarterKitBodySchema = z.object({
  projectId: z.string().optional(),
  name: z.string().optional(),
});

const createTemplateFromStarterKitContract = c.mutation({
  method: 'POST',
  path: '/starter-kits/:starterKitId/templates',
  body: CreateTemplateFromStarterKitBodySchema,
  pathParams: z.object({
    starterKitId: z.string(),
  }),
  responses: {
    201: CreatedTemplateFromStarterKitSchema,
  },
});

export const starterKitsContracts = c.router({
  createAgentFromStarterKit: createAgentFromStarterKitContract,
  createTemplateFromStarterKit: createTemplateFromStarterKitContract,
});

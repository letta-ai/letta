import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { AgentFileAccessLevels } from '@letta-cloud/types';
import { zodTypes } from '@letta-cloud/sdk-core';

const c = initContract();

const GetAgentFileMetadataSchema = z.object({
  accessLevel: AgentFileAccessLevels,
  agentId: z.string(),
  name: z.string(),
  description: z.string(),
});

export type GetAgentFileMetadataType = z.infer<
  typeof GetAgentFileMetadataSchema
>;

const getAgentfileMetadataContract = c.query({
  path: '/agentfiles/:agentId',
  method: 'GET',
  pathParams: z.object({
    agentId: z.string(),
  }),
  responses: {
    200: GetAgentFileMetadataSchema,
  },
});

const UpdateAgentfileAccessLevelRequestBodySchema = z.object({
  name: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'Name must be alphanumeric with underscores or dashes',
    })
    .min(1)
    .max(25),
  description: z.string().max(200).min(1).optional(),
  accessLevel: AgentFileAccessLevels,
});

const getAgentfileContract = c.query({
  method: 'GET',
  path: '/agentfiles/:agentId/download',
  pathParams: z.object({
    agentId: z.string(),
  }),
  responses: {
    200: z.any(),
  },
});

const GetAgentfileSummarySchema = z.object({
  memory: z
    .object({
      label: z.string(),
      value: z.string(),
    })
    .array(),
  tools: z
    .object({
      name: z.string(),
      source_type: z.string(),
      description: z.string(),
    })
    .array(),
  system: z.string(),
  name: z.string(),
  description: z.string(),
  author: z.string(),
});

const getAgentfileSummaryContract = c.query({
  path: '/agentfiles/:agentId/summary',
  method: 'GET',
  pathParams: z.object({
    agentId: z.string(),
  }),
  responses: {
    200: GetAgentfileSummarySchema,
  },
});

const createAgentfileMetadataContract = c.mutation({
  method: 'POST',
  path: '/agentfiles/:agentId',
  pathParams: z.object({
    agentId: z.string(),
  }),
  body: UpdateAgentfileAccessLevelRequestBodySchema,
  responses: {
    200: GetAgentFileMetadataSchema,
  },
});

const updateAgentfileAccessLevelContract = c.mutation({
  method: 'PATCH',
  path: '/agentfiles/:agentId/access-level',
  pathParams: z.object({
    agentId: z.string(),
  }),
  body: UpdateAgentfileAccessLevelRequestBodySchema,
  responses: {
    200: z.object({
      accessLevel: AgentFileAccessLevels,
      agentId: z.string(),
    }),
  },
});

const GetAgentFileDetailsSchema = z.object({
  name: z.string(),
  description: z.string(),
  author: z.string(),
  downloadCount: z.number(),
  publishedAt: z.string(),
  upvotes: z.number(),
  downvotes: z.number(),
  llmConfig: z.object({
    handle: z.string(),
    temperature: z.number(),
    maxTokens: z.number(),
  }),
  system: z.string(),
  memory: z
    .object({
      label: z.string(),
      value: z.string(),
    })
    .array(),
  tools: z
    .object({
      name: z.string(),
      source_type: z.string(),
      description: z.string(),
    })
    .array(),
  toolRules: zodTypes.AgentState.shape.tool_rules,
  toolVariables: z
    .object({
      name: z.string(),
      value: z.string(),
    })
    .array()
    .optional(),
});

export type GetAgentFileDetails = z.infer<typeof GetAgentFileDetailsSchema>;

const getAgentfileDetailsContract = c.query({
  path: '/agentfiles/:agentId/details',
  method: 'GET',
  pathParams: z.object({
    agentId: z.string(),
  }),
  responses: {
    200: GetAgentFileDetailsSchema,
  },
});

const GetAgentfilePartialDetailsSchema = z.object({
  name: z.string(),
  agentId: z.string(),
  author: z.string(),
  description: z.string(),
  downloadCount: z.number(),
});

export type GetAgentfilePartialDetailsType = z.infer<
  typeof GetAgentfilePartialDetailsSchema
>;

const listAgentfilesContract = c.query({
  path: '/agentfiles',
  method: 'GET',
  query: z.object({
    limit: z.number().max(25).optional(),
    offset: z.number().optional(),
    search: z.string().optional(),
  }),
  responses: {
    200: z.object({
      totalCount: z.number(),
      items: GetAgentfilePartialDetailsSchema.array(),
      hasNextPage: z.boolean(),
    }),
  },
});

export const agentfileContracts = c.router({
  getAgentfile: getAgentfileContract,
  getAgentfileSummary: getAgentfileSummaryContract,
  createAgentfileMetadata: createAgentfileMetadataContract,
  updateAgentfileAccessLevel: updateAgentfileAccessLevelContract,
  getAgentfileDetails: getAgentfileDetailsContract,
  getAgentfileMetadata: getAgentfileMetadataContract,
  listAgentfiles: listAgentfilesContract,
});

export const agentfileQueryClientKeys = {
  getAgentfileSummary: (agentId: string) => ['agentfileSummary', agentId],
  getAgentfileMetadata: (agentId: string) => ['agentfileMetadata', agentId],
  getAgentfileDetails: (agentId: string) => ['agentfileDetails', agentId],
  getAgentfile: (agentId: string) => ['agentId', agentId],
};

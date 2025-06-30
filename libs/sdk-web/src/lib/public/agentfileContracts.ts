import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { AgentFileAccessLevels } from '@letta-cloud/types';

const c = initContract();

const GetAgentFileMetadata = z.object({
  accessLevel: AgentFileAccessLevels,
  agentId: z.string(),
});

const getAgentfileMetadataContract = c.query({
  path: '/agentfiles/:agentId',
  method: 'GET',
  pathParams: z.object({
    agentId: z.string(),
  }),
  responses: {
    200: GetAgentFileMetadata,
  },
});

const UpdateAgentfileAccessLevelRequestBodySchema = z.object({
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

const cloneAgentfileContract = c.mutation({
  method: 'POST',
  path: '/agentfiles/:agentId/clone',
  pathParams: z.object({
    agentId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.object({
      redirectUrl: z.string(),
    }),
  },
});

const createAgentfileMetadataContract = c.mutation({
  method: 'POST',
  path: '/agentfiles/:agentId',
  pathParams: z.object({
    agentId: z.string(),
  }),
  body: z.object({
    accessLevel: AgentFileAccessLevels,
  }),
  responses: {
    200: GetAgentFileMetadata,
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

export const agentfileContracts = c.router({
  getAgentfile: getAgentfileContract,
  getAgentfileSummary: getAgentfileSummaryContract,
  cloneAgentfile: cloneAgentfileContract,
  createAgentfileMetadata: createAgentfileMetadataContract,
  updateAgentfileAccessLevel: updateAgentfileAccessLevelContract,
  getAgentfileMetadata: getAgentfileMetadataContract,
});

export const agentfileQueryClientKeys = {
  getAgentfileSummary: (agentId: string) => ['agentfileSummary', agentId],
  getAgentfileMetadata: (agentId: string) => ['agentfileMetadata', agentId],
  getAgentfile: (agentId: string) => ['agentId', agentId],
  cloneAgentfile: (agentId: string) => ['agentId', agentId],
};

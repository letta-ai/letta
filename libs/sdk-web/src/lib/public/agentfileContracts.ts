import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

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

const cloneAgentfileContract = c.mutation({
  method: 'POST',
  path: '/agentfiles/:agentId/clone',
  pathParams: z.object({
    agentId: z.string(),
  }),
  body: z.undefined(),
  responses: {
    200: z.string(),
  },
});

export const agentfileContracts = c.router({
  getAgentfile: getAgentfileContract,
  cloneAgentfile: cloneAgentfileContract,
});

export const agentfileQueryClientKeys = {
  getAgentfile: (agentId: string) => ['agentId', agentId],
  cloneAgentfile: (agentId: string) => ['agentId', agentId],
};

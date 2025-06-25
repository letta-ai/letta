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

export const agentfileContracts = c.router({
  getAgentfile: getAgentfileContract,
});

export const agentfileQueryClientKeys = {
  getAgentfile: (agentId: string) => ['agentId', agentId],
};

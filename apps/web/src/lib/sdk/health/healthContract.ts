import { initContract } from '@ts-rest/core';

import { z } from 'zod';

import { extendZodWithOpenApi } from '@anatine/zod-openapi';

extendZodWithOpenApi(z);

const c = initContract();

const GetHealthResponseSchema = z.object({
  status: z.string(),
});

const getHealth = c.query({
  method: 'GET',
  path: '/v1/health',
  responses: {
    200: GetHealthResponseSchema,
  },
});

export const healthContract = c.router({
  getHealth,
});

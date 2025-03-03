import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const flushLayouts = c.mutation({
  method: 'POST',
  path: '/admin/flush-whitelists',
  body: z.undefined(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

export const flushLayoutsContract = c.router({
  flushLayouts,
});

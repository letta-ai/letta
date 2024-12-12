import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const syncToolsWithComposioContract = c.mutation({
  method: 'POST',
  path: '/admin/tools/sync-tools-with-composio',
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
  body: z.undefined(),
});

export const adminToolMetadataContracts = c.router({
  syncToolsWithComposio: syncToolsWithComposioContract,
});

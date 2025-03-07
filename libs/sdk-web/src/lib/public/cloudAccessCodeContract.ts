import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const SubmitCloudAccessCodeContract = c.mutation({
  method: 'POST',
  path: '/cloud-access-code',
  summary: 'Submit Cloud Access Code',
  body: z.object({
    code: z.string(),
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
  },
});

export const cloudAccessCodeContract = c.router({
  submitCloudAccessCode: SubmitCloudAccessCodeContract,
});

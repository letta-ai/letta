import { initContract } from '@ts-rest/core';
import { z } from 'zod';
const c = initContract();

const verifySSOEmailContract = c.mutation({
  path: '/verify-sso-email',
  method: 'POST',
  body: z.object({
    email: z.string(),
  }),
  responses: {
    200: z.object({
      redirectUrl: z.string(),
    }),
    400: z.object({
      errorCode: z.enum(['invalidSSO']),
    }),
  },
});

export const ssoContracts = {
  verifySSOEmail: verifySSOEmailContract,
};

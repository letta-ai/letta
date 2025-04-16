import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { accessPolicyArray, accessPolicyVersionOne } from '@letta-cloud/types';

const c = initContract();

//
// const PublicClientSideAccessTokenDetails = z.object({
//   policy: accessPolicyVersionOne,
//   lastFourTokenValue: z.string(),
//   hostname: z.string(),
//   expiresAt: z.string(),
// })

const CreatedClientSideAccessToken = z.object({
  policy: accessPolicyVersionOne,
  token: z.string(),
  hostname: z.string(),
  expiresAt: z.string(),
});

const CreateClientSideAccessTokenPayload = z.object({
  policy: accessPolicyArray,
  hostname: z
    .string()
    .url()
    .regex(/^(http|https):\/\//)
    .refine((val) => !val.endsWith('/'), {
      message: 'The hostname should not end with a slash',
    })
    .openapi({
      description:
        'The hostname of the client side application. Please specify the full URL including the protocol (http or https).',
    }),
  expires_at: z.string().optional().openapi({
    description:
      'The expiration date of the token. If not provided, the token will expire in 5 minutes',
  }),
  // expire_other_tokens: z.boolean().default(true).optional().openapi({
  //   description: 'If true, any tokens that share the same policies will be invalidated. Defaults to true as this is recommended for security reasons.',
  // }),
});

const createClientSideAccessTokenContract = c.mutation({
  path: '/v1/client-side-access-tokens',
  method: 'POST',
  summary: 'Create Client Side Access Token',
  description:
    'Create a new client side access token with the specified configuration.',
  body: CreateClientSideAccessTokenPayload,
  responses: {
    201: CreatedClientSideAccessToken,
    400: z.object({
      message: z.string(),
    }),
  },
});

const deleteClientSideAccessTokenContract = c.mutation({
  path: '/v1/client-side-access-tokens/:token',
  method: 'DELETE',
  summary: 'Delete Client Side Access Token',
  description: 'Delete a client side access token.',
  pathParams: z.object({
    token: z.string().openapi({
      description: 'The access token to delete',
    }),
  }),
  body: z.undefined(),
  responses: {
    204: z.undefined(),
    400: z.object({
      message: z.string(),
    }),
  },
});

export const clientSideAccessTokensContract = {
  createClientSideAccessToken: createClientSideAccessTokenContract,
  deleteClientSideAccessToken: deleteClientSideAccessTokenContract,
};

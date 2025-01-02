import { z } from 'zod';
import { supportedProvidersSchema } from '@letta-cloud/web-api-client';

export const authProviderContextSchema = z.object({
  params: z
    .object({
      provider: supportedProvidersSchema,
    })
    .promise(),
});

export type AuthProviderContextSchema = z.infer<
  typeof authProviderContextSchema
>;

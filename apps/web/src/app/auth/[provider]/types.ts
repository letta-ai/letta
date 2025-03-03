import { z } from 'zod';
import { supportedProvidersSchema } from '@letta-cloud/sdk-web';

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

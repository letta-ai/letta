import { z } from 'zod';
import { supportedProvidersSchema } from '$letta/types';

export const authProviderContextSchema = z.object({
  params: z.object({
    provider: supportedProvidersSchema,
  }),
});

export type AuthProviderContextSchema = z.infer<
  typeof authProviderContextSchema
>;

import { z } from 'zod';

export const authProviderContextSchema = z.object({
  params: z
    .object({
      provider: z.string(),
    })
    .promise(),
});

export type AuthProviderContextSchema = z.infer<
  typeof authProviderContextSchema
>;

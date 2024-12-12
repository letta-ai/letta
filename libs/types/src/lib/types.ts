import { z } from 'zod';

export const ComposioProviderConfiguration = z.object({
  type: z.literal('composio'),
  name: z.string(),
  enum: z.string(),
  logo: z.string(),
  displayName: z.string(),
  appId: z.string(),
  tags: z.array(z.string()),
})

export const GenericProviderConfiguration = z.object({
  type: z.literal('generic'),
  name: z.string(),
})

export const ProviderSchemaConfiguration = z.union([ComposioProviderConfiguration, GenericProviderConfiguration])

export type ProviderConfiguration = z.infer<typeof ProviderSchemaConfiguration>

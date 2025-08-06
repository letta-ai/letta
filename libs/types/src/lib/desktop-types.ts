import { z } from 'zod';

export const DesktopEmbeddedDatabaseSchema = z.object({
  type: z.literal('embedded'),
  embeddedType: z.enum(['pgserver', 'pglite', 'sqlite']),
});

export const DesktopExternalDatabaseSchema = z.object({
  type: z.literal('external'),
  connectionString: z.string(),
});

export const LocalServerSchema = z.object({
  type: z.literal('local'),
  url: z.string().url(),
  token: z.string().optional(),
});

export const CloudServerSchema = z.object({
  type: z.literal('cloud'),
  token: z.string(),
});

const DesktopDiscriminatedUnionDatabaseSchema = z.discriminatedUnion('type', [
  DesktopEmbeddedDatabaseSchema,
  DesktopExternalDatabaseSchema,
  LocalServerSchema,
  CloudServerSchema,
]);

export const DesktopConfigSchema = z.object({
  version: z.string(),
  databaseConfig: DesktopDiscriminatedUnionDatabaseSchema,
});

export type DesktopConfigSchemaType = z.infer<typeof DesktopConfigSchema>;

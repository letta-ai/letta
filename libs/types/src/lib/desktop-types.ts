import { z } from 'zod';

export const DesktopEmbeddedDatabaseSchema = z.object({
  type: z.literal('embedded'),
  embeddedType: z.enum(['pgserver', 'pglite']),
});

export const DesktopExternalDatabaseSchema = z.object({
  type: z.literal('external'),
  connectionString: z.string(),
});

const DesktopDiscriminatedUnionDatabaseSchema = z.discriminatedUnion('type', [
  DesktopEmbeddedDatabaseSchema,
  DesktopExternalDatabaseSchema,
]);

export const DesktopConfigSchema = z.object({
  version: z.string(),
  databaseConfig: DesktopDiscriminatedUnionDatabaseSchema,
});

export type DesktopConfigSchemaType = z.infer<typeof DesktopConfigSchema>;

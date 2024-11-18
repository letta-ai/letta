import type { ToZod } from '@letta-web/helpful-client-utils';
import type { Block } from '@letta-web/letta-agents-api';
import { z } from 'zod';



const BlockMetadataSchema = z.record(z.unknown());

export const BlockSchema: ToZod<Omit<Block, 'metadata_'>> = z.object({
  value: z.string(),
  limit: z.number().optional(),
  name: z.string().nullable().optional(),

  template: z.boolean().optional(),
  label: z.string().optional(),

  description: z.string().nullable().optional(),
  metadata_: BlockMetadataSchema.optional(),
  user_id: z.string().nullable().optional(),
  id: z.string().optional(),
});

export const MemorySchema = z.object({
  memory: z.record(BlockSchema).optional(),
  prompt_template: z.string().optional(),
});

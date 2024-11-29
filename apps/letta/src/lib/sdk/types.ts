import type { ToZod } from '@letta-web/helpful-client-utils';
import type { Block, CreateBlock } from '@letta-web/letta-agents-api';
import { z } from 'zod';

const BlockMetadataSchema = z.record(z.unknown());

export const BlockSchema: ToZod<Omit<Block, 'metadata_'>> = z.object({
  value: z.string(),
  limit: z.number().optional(),
  name: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  metadata_: BlockMetadataSchema.optional(),
  id: z.string().optional(),
  organization_id: z.string().nullable().optional(),
  created_by_id: z.string().nullable().optional(),
  last_updated_by_id: z.string().nullable().optional(),
  is_template: z.boolean().optional(),
});

export const MemorySchema = z.object({
  memory: z.record(BlockSchema).optional(),
  prompt_template: z.string().optional(),
});

export const CreateBlockSchema: ToZod<Omit<CreateBlock, 'metadata_'>> =
  z.object({
    value: z.string(),
    limit: z.number().optional(),
    name: z.string().nullable().optional(),
    label: z.string(),
    description: z.string().nullable().optional(),
    metadata_: BlockMetadataSchema.optional(),
    is_template: z.boolean().optional(),
  });

export const MemoryBlocksSchema = z.array(CreateBlockSchema);

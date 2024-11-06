import type { ToZod } from '@letta-web/helpful-client-utils';
import type { Block } from '@letta-web/letta-agents-api';
import { z } from 'zod';

const modelEndpointTypesSchema = z.enum([
  'openai',
  'anthropic',
  'cohere',
  'google_ai',
  'azure',
  'groq',
  'ollama',
  'webui',
  'webui-legacy',
  'lmstudio',
  'lmstudio-legacy',
  'llamacpp',
  'koboldcpp',
  'vllm',
  'hugging-face',
]);

// matches LLMConfig but enum is broken with ToZod
export const LLMConfigSchema = z.object({
  model: z.string(),
  model_endpoint_type: modelEndpointTypesSchema,
  model_endpoint: z.string().optional().nullable(),
  model_wrapper: z.string().nullable().optional(),
  context_window: z.number(),
});

export const EmbeddingConfigSchema = z.object({
  embedding_endpoint_type: z.string(),
  embedding_endpoint: z.string().optional().nullable(),
  embedding_model: z.string(),
  embedding_dim: z.number(),
  embedding_chunk_size: z.number().optional().nullable(),
  azure_endpoint: z.string().optional().nullable(),
  azure_version: z.string().optional().nullable(),
  azure_deployment: z.string().optional().nullable(),
});

const BlockMetadataSchema = z.record(z.unknown());

export const BlockSchema: ToZod<Omit<Block, 'metadata_'>> = z.object({
  value: z.string(),
  limit: z.number().optional(),
  template_name: z.string().nullable().optional(),

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

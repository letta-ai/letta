import { z } from 'zod';

export type ActionParametersModel = z.infer<typeof ActionParametersModel>;
export const ActionParametersModel = z.object({
  properties: z.unknown(),
  title: z.string(),
  type: z.string(),
  required: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  examples: z
    .union([
      z.array(z.unknown()),
      z.null(),
      z.array(z.union([z.array(z.unknown()), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ActionResponseModel = z.infer<typeof ActionResponseModel>;
export const ActionResponseModel = z.object({
  properties: z.unknown(),
  title: z.string(),
  type: z.string(),
  required: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  examples: z
    .union([
      z.array(z.unknown()),
      z.null(),
      z.array(z.union([z.array(z.unknown()), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ActionModel = z.infer<typeof ActionModel>;
export const ActionModel = z.object({
  name: z.string(),
  description: z.string(),
  parameters: ActionParametersModel,
  response: ActionResponseModel,
  appName: z.string(),
  appId: z.string(),
  version: z.string(),
  available_versions: z.array(z.string()),
  tags: z.array(z.string()),
  logo: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  display_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enabled: z.union([z.boolean(), z.undefined()]).optional(),
});

export type AgentEnvironmentVariable = z.infer<typeof AgentEnvironmentVariable>;
export const AgentEnvironmentVariable = z.object({
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  key: z.string(),
  value: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_id: z.string(),
});

export type AgentFileAttachment = z.infer<typeof AgentFileAttachment>;
export const AgentFileAttachment = z.object({
  id: z.string(),
  file_id: z.string(),
  file_name: z.string(),
  folder_id: z.string(),
  folder_name: z.string(),
  is_open: z.boolean(),
  last_accessed_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  visible_content: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  start_line: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  end_line: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type CreateBlock = z.infer<typeof CreateBlock>;
export const CreateBlock = z.object({
  value: z.string(),
  limit: z.union([z.number(), z.undefined()]).optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_template: z.union([z.boolean(), z.undefined()]).optional(),
  base_template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  deployment_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  entity_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  preserve_on_migration: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  label: z.string(),
  read_only: z.union([z.boolean(), z.undefined()]).optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ChildToolRule = z.infer<typeof ChildToolRule>;
export const ChildToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
  children: z.array(z.string()),
});

export type InitToolRule = z.infer<typeof InitToolRule>;
export const InitToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
});

export type TerminalToolRule = z.infer<typeof TerminalToolRule>;
export const TerminalToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
});

export type ConditionalToolRule = z.infer<typeof ConditionalToolRule>;
export const ConditionalToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
  default_child: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  child_output_mapping: z.unknown(),
  require_output_mapping: z.union([z.boolean(), z.undefined()]).optional(),
});

export type ContinueToolRule = z.infer<typeof ContinueToolRule>;
export const ContinueToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
});

export type RequiredBeforeExitToolRule = z.infer<
  typeof RequiredBeforeExitToolRule
>;
export const RequiredBeforeExitToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
});

export type MaxCountPerStepToolRule = z.infer<typeof MaxCountPerStepToolRule>;
export const MaxCountPerStepToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
  max_count_limit: z.number(),
});

export type ParentToolRule = z.infer<typeof ParentToolRule>;
export const ParentToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
  children: z.array(z.string()),
});

export type RequiresApprovalToolRule = z.infer<typeof RequiresApprovalToolRule>;
export const RequiresApprovalToolRule = z.object({
  tool_name: z.string(),
  type: z.union([z.string(), z.undefined()]).optional(),
  prompt_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  requires_force_tool_call: z.union([z.boolean(), z.undefined()]).optional(),
});

export type AgentType = z.infer<typeof AgentType>;
export const AgentType = z.union([
  z.literal('memgpt_agent'),
  z.literal('memgpt_v2_agent'),
  z.literal('letta_v1_agent'),
  z.literal('react_agent'),
  z.literal('workflow_agent'),
  z.literal('split_thread_agent'),
  z.literal('sleeptime_agent'),
  z.literal('voice_convo_agent'),
  z.literal('voice_sleeptime_agent'),
]);

export type ProviderCategory = z.infer<typeof ProviderCategory>;
export const ProviderCategory = z.union([z.literal('base'), z.literal('byok')]);

export type LLMConfig = z.infer<typeof LLMConfig>;
export const LLMConfig = z.object({
  model: z.string(),
  model_endpoint_type: z.union([
    z.literal('openai'),
    z.literal('anthropic'),
    z.literal('google_ai'),
    z.literal('google_vertex'),
    z.literal('azure'),
    z.literal('groq'),
    z.literal('ollama'),
    z.literal('webui'),
    z.literal('webui-legacy'),
    z.literal('lmstudio'),
    z.literal('lmstudio-legacy'),
    z.literal('lmstudio-chatcompletions'),
    z.literal('llamacpp'),
    z.literal('koboldcpp'),
    z.literal('vllm'),
    z.literal('hugging-face'),
    z.literal('mistral'),
    z.literal('together'),
    z.literal('bedrock'),
    z.literal('deepseek'),
    z.literal('xai'),
  ]),
  model_endpoint: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  provider_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  provider_category: z
    .union([
      ProviderCategory,
      z.null(),
      z.array(z.union([ProviderCategory, z.null()])),
      z.undefined(),
    ])
    .optional(),
  model_wrapper: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  context_window: z.number(),
  put_inner_thoughts_in_kwargs: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  handle: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  temperature: z.union([z.number(), z.undefined()]).optional(),
  max_tokens: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enable_reasoner: z.union([z.boolean(), z.undefined()]).optional(),
  reasoning_effort: z
    .union([
      z.literal('minimal'),
      z.literal('low'),
      z.literal('medium'),
      z.literal('high'),
      z.null(),
      z.array(
        z.union([
          z.literal('minimal'),
          z.literal('low'),
          z.literal('medium'),
          z.literal('high'),
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  max_reasoning_tokens: z.union([z.number(), z.undefined()]).optional(),
  frequency_penalty: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  compatibility_type: z
    .union([
      z.literal('gguf'),
      z.literal('mlx'),
      z.null(),
      z.array(z.union([z.literal('gguf'), z.literal('mlx'), z.null()])),
      z.undefined(),
    ])
    .optional(),
  verbosity: z
    .union([
      z.literal('low'),
      z.literal('medium'),
      z.literal('high'),
      z.null(),
      z.array(
        z.union([
          z.literal('low'),
          z.literal('medium'),
          z.literal('high'),
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  tier: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type EmbeddingConfig = z.infer<typeof EmbeddingConfig>;
export const EmbeddingConfig = z.object({
  embedding_endpoint_type: z.union([
    z.literal('openai'),
    z.literal('anthropic'),
    z.literal('bedrock'),
    z.literal('google_ai'),
    z.literal('google_vertex'),
    z.literal('azure'),
    z.literal('groq'),
    z.literal('ollama'),
    z.literal('webui'),
    z.literal('webui-legacy'),
    z.literal('lmstudio'),
    z.literal('lmstudio-legacy'),
    z.literal('llamacpp'),
    z.literal('koboldcpp'),
    z.literal('vllm'),
    z.literal('hugging-face'),
    z.literal('mistral'),
    z.literal('together'),
    z.literal('pinecone'),
  ]),
  embedding_endpoint: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_model: z.string(),
  embedding_dim: z.number(),
  embedding_chunk_size: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  handle: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  batch_size: z.union([z.number(), z.undefined()]).optional(),
  azure_endpoint: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  azure_version: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  azure_deployment: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type TextContent = z.infer<typeof TextContent>;
export const TextContent = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  text: z.string(),
});

export type UrlImage = z.infer<typeof UrlImage>;
export const UrlImage = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  url: z.string(),
});

export type Base64Image = z.infer<typeof Base64Image>;
export const Base64Image = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  media_type: z.string(),
  data: z.string(),
  detail: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type LettaImage = z.infer<typeof LettaImage>;
export const LettaImage = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  file_id: z.string(),
  media_type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  data: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  detail: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ImageContent = z.infer<typeof ImageContent>;
export const ImageContent = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  source: z.union([UrlImage, Base64Image, LettaImage]),
});

export type ToolCallContent = z.infer<typeof ToolCallContent>;
export const ToolCallContent = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

export type ToolReturnContent = z.infer<typeof ToolReturnContent>;
export const ToolReturnContent = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  tool_call_id: z.string(),
  content: z.string(),
  is_error: z.boolean(),
});

export type ReasoningContent = z.infer<typeof ReasoningContent>;
export const ReasoningContent = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  is_native: z.boolean(),
  reasoning: z.string(),
  signature: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type RedactedReasoningContent = z.infer<typeof RedactedReasoningContent>;
export const RedactedReasoningContent = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  data: z.string(),
});

export type OmittedReasoningContent = z.infer<typeof OmittedReasoningContent>;
export const OmittedReasoningContent = z.object({
  type: z.string().optional(),
});

export type LettaMessageContentUnion = z.infer<typeof LettaMessageContentUnion>;
export const LettaMessageContentUnion = z.union([
  TextContent,
  ImageContent,
  ToolCallContent,
  ToolReturnContent,
  ReasoningContent,
  RedactedReasoningContent,
  OmittedReasoningContent,
]);

export type MessageCreate = z.infer<typeof MessageCreate>;
export const MessageCreate = z.object({
  type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  role: z.union([
    z.literal('user'),
    z.literal('system'),
    z.literal('assistant'),
  ]),
  content: z.union([
    z.array(LettaMessageContentUnion),
    z.string(),
    z.array(z.union([z.array(LettaMessageContentUnion), z.string()])),
  ]),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  batch_item_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  group_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type TextResponseFormat = z.infer<typeof TextResponseFormat>;
export const TextResponseFormat = z.object({
  type: z.string().optional(),
});

export type JsonSchemaResponseFormat = z.infer<typeof JsonSchemaResponseFormat>;
export const JsonSchemaResponseFormat = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  json_schema: z.unknown(),
});

export type JsonObjectResponseFormat = z.infer<typeof JsonObjectResponseFormat>;
export const JsonObjectResponseFormat = z.object({
  type: z.string().optional(),
});

export type MessageRole = z.infer<typeof MessageRole>;
export const MessageRole = z.union([
  z.literal('assistant'),
  z.literal('user'),
  z.literal('tool'),
  z.literal('function'),
  z.literal('system'),
  z.literal('approval'),
]);

export type Function = z.infer<typeof Function>;
export const Function = z.intersection(
  z.object({
    arguments: z.string(),
    name: z.string(),
  }),
  z.object({
    string: z.any(),
  }),
);

export type ChatCompletionMessageFunctionToolCall = z.infer<
  typeof ChatCompletionMessageFunctionToolCall
>;
export const ChatCompletionMessageFunctionToolCall = z.intersection(
  z.object({
    id: z.string(),
    function: z.function().args().returns(z.unknown()),
    type: z.string(),
  }),
  z.object({
    string: z.any(),
  }),
);

export type ToolReturn = z.infer<typeof ToolReturn>;
export const ToolReturn = z.object({
  status: z.union([z.literal('success'), z.literal('error')]),
  stdout: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  stderr: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type letta__schemas__agent_file__MessageSchema = z.infer<
  typeof letta__schemas__agent_file__MessageSchema
>;
export const letta__schemas__agent_file__MessageSchema = z.object({
  type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  role: MessageRole,
  content: z.union([
    z.array(LettaMessageContentUnion),
    z.string(),
    z.array(z.union([z.array(LettaMessageContentUnion), z.string()])),
  ]),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  batch_item_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  group_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
  model: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_calls: z
    .union([
      z.array(ChatCompletionMessageFunctionToolCall),
      z.null(),
      z.array(
        z.union([z.array(ChatCompletionMessageFunctionToolCall), z.null()]),
      ),
      z.undefined(),
    ])
    .optional(),
  tool_call_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_returns: z
    .union([
      z.array(ToolReturn),
      z.null(),
      z.array(z.union([z.array(ToolReturn), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z.union([z.string(), z.undefined()]).optional(),
});

export type FileAgentSchema = z.infer<typeof FileAgentSchema>;
export const FileAgentSchema = z.object({
  agent_id: z.string(),
  file_id: z.string(),
  source_id: z.string(),
  file_name: z.string(),
  is_open: z.union([z.boolean(), z.undefined()]).optional(),
  visible_content: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_accessed_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  start_line: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  end_line: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
});

export type letta__schemas__agent_file__AgentSchema = z.infer<
  typeof letta__schemas__agent_file__AgentSchema
>;
export const letta__schemas__agent_file__AgentSchema = z.object({
  name: z.union([z.string(), z.undefined()]).optional(),
  memory_blocks: z
    .union([
      z.array(CreateBlock),
      z.null(),
      z.array(z.union([z.array(CreateBlock), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tools: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  source_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  block_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_rules: z
    .union([
      z.array(
        z.union([
          ChildToolRule,
          InitToolRule,
          TerminalToolRule,
          ConditionalToolRule,
          ContinueToolRule,
          RequiredBeforeExitToolRule,
          MaxCountPerStepToolRule,
          ParentToolRule,
          RequiresApprovalToolRule,
        ]),
      ),
      z.null(),
      z.array(
        z.union([
          z.array(
            z.union([
              ChildToolRule,
              InitToolRule,
              TerminalToolRule,
              ConditionalToolRule,
              ContinueToolRule,
              RequiredBeforeExitToolRule,
              MaxCountPerStepToolRule,
              ParentToolRule,
              RequiresApprovalToolRule,
            ]),
          ),
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  system: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_type: z.union([AgentType, z.undefined()]).optional(),
  llm_config: z
    .union([
      LLMConfig,
      z.null(),
      z.array(z.union([LLMConfig, z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_config: z
    .union([
      EmbeddingConfig,
      z.null(),
      z.array(z.union([EmbeddingConfig, z.null()])),
      z.undefined(),
    ])
    .optional(),
  initial_message_sequence: z
    .union([
      z.array(MessageCreate),
      z.null(),
      z.array(z.union([z.array(MessageCreate), z.null()])),
      z.undefined(),
    ])
    .optional(),
  include_base_tools: z.union([z.boolean(), z.undefined()]).optional(),
  include_multi_agent_tools: z.union([z.boolean(), z.undefined()]).optional(),
  include_base_tool_rules: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  include_default_source: z.union([z.boolean(), z.undefined()]).optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  model: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  context_window_limit: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_chunk_size: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_tokens: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_reasoning_tokens: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enable_reasoner: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  reasoning: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  from_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  template: z.union([z.boolean(), z.undefined()]).optional(),
  project: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_exec_environment_variables: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  secrets: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  memory_variables: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  identity_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_buffer_autoclear: z.union([z.boolean(), z.undefined()]).optional(),
  enable_sleeptime: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  response_format: z
    .union([
      TextResponseFormat,
      JsonSchemaResponseFormat,
      JsonObjectResponseFormat,
      z.null(),
      z.array(
        z.union([
          TextResponseFormat,
          JsonSchemaResponseFormat,
          JsonObjectResponseFormat,
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  timezone: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_files_open: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  per_file_view_window_char_limit: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
  in_context_message_ids: z
    .union([z.array(z.string()), z.undefined()])
    .optional(),
  messages: z
    .union([z.array(letta__schemas__agent_file__MessageSchema), z.undefined()])
    .optional(),
  files_agents: z.union([z.array(FileAgentSchema), z.undefined()]).optional(),
  group_ids: z.union([z.array(z.string()), z.undefined()]).optional(),
});

export type RoundRobinManager = z.infer<typeof RoundRobinManager>;
export const RoundRobinManager = z.object({
  manager_type: z.string().optional(),
  max_turns: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
});

export type SupervisorManager = z.infer<typeof SupervisorManager>;
export const SupervisorManager = z.object({
  manager_type: z.union([z.string(), z.undefined()]).optional(),
  manager_agent_id: z.string(),
});

export type DynamicManager = z.infer<typeof DynamicManager>;
export const DynamicManager = z.object({
  manager_type: z.union([z.string(), z.undefined()]).optional(),
  manager_agent_id: z.string(),
  termination_token: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_turns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type SleeptimeManager = z.infer<typeof SleeptimeManager>;
export const SleeptimeManager = z.object({
  manager_type: z.union([z.string(), z.undefined()]).optional(),
  manager_agent_id: z.string(),
  sleeptime_agent_frequency: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type VoiceSleeptimeManager = z.infer<typeof VoiceSleeptimeManager>;
export const VoiceSleeptimeManager = z.object({
  manager_type: z.union([z.string(), z.undefined()]).optional(),
  manager_agent_id: z.string(),
  max_message_buffer_length: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  min_message_buffer_length: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type GroupSchema = z.infer<typeof GroupSchema>;
export const GroupSchema = z.object({
  agent_ids: z.array(z.string()),
  description: z.string(),
  manager_config: z
    .union([
      RoundRobinManager,
      SupervisorManager,
      DynamicManager,
      SleeptimeManager,
      VoiceSleeptimeManager,
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  shared_block_ids: z.union([z.array(z.string()), z.undefined()]).optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
});

export type BlockSchema = z.infer<typeof BlockSchema>;
export const BlockSchema = z.object({
  value: z.string(),
  limit: z.union([z.number(), z.undefined()]).optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_template: z.union([z.boolean(), z.undefined()]).optional(),
  base_template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  deployment_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  entity_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  preserve_on_migration: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  label: z.string(),
  read_only: z.union([z.boolean(), z.undefined()]).optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
});

export type FileProcessingStatus = z.infer<typeof FileProcessingStatus>;
export const FileProcessingStatus = z.union([
  z.literal('pending'),
  z.literal('parsing'),
  z.literal('embedding'),
  z.literal('completed'),
  z.literal('error'),
]);

export type FileSchema = z.infer<typeof FileSchema>;
export const FileSchema = z.object({
  source_id: z.string(),
  file_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  original_file_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_path: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_size: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_creation_date: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_last_modified_date: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  processing_status: z.union([FileProcessingStatus, z.undefined()]).optional(),
  error_message: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  total_chunks: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  chunks_embedded: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  content: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
});

export type SourceSchema = z.infer<typeof SourceSchema>;
export const SourceSchema = z.object({
  name: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  instructions: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_chunk_size: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_config: z
    .union([
      EmbeddingConfig,
      z.null(),
      z.array(z.union([EmbeddingConfig, z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
});

export type ToolType = z.infer<typeof ToolType>;
export const ToolType = z.union([
  z.literal('custom'),
  z.literal('letta_core'),
  z.literal('letta_memory_core'),
  z.literal('letta_multi_agent_core'),
  z.literal('letta_sleeptime_core'),
  z.literal('letta_voice_sleeptime_core'),
  z.literal('letta_builtin'),
  z.literal('letta_files_core'),
  z.literal('external_composio'),
  z.literal('external_langchain'),
  z.literal('external_mcp'),
]);

export type PipRequirement = z.infer<typeof PipRequirement>;
export const PipRequirement = z.object({
  name: z.string(),
  version: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type NpmRequirement = z.infer<typeof NpmRequirement>;
export const NpmRequirement = z.object({
  name: z.string(),
  version: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type letta__schemas__agent_file__ToolSchema = z.infer<
  typeof letta__schemas__agent_file__ToolSchema
>;
export const letta__schemas__agent_file__ToolSchema = z.object({
  id: z.string(),
  tool_type: z.union([ToolType, z.undefined()]).optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  source_type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tags: z.union([z.array(z.string()), z.undefined()]).optional(),
  source_code: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  json_schema: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  args_json_schema: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  return_char_limit: z.union([z.number(), z.undefined()]).optional(),
  pip_requirements: z
    .union([
      z.array(PipRequirement),
      z.null(),
      z.array(z.union([z.array(PipRequirement), z.null()])),
      z.undefined(),
    ])
    .optional(),
  npm_requirements: z
    .union([
      z.array(NpmRequirement),
      z.null(),
      z.array(z.union([z.array(NpmRequirement), z.null()])),
      z.undefined(),
    ])
    .optional(),
  default_requires_approval: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata_: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type MCPServerSchema = z.infer<typeof MCPServerSchema>;
export const MCPServerSchema = z.object({
  id: z.string(),
  server_type: z.string(),
  server_name: z.string(),
  server_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  stdio_config: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata_: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type AgentFileSchema = z.infer<typeof AgentFileSchema>;
export const AgentFileSchema = z.object({
  agents: z.array(letta__schemas__agent_file__AgentSchema),
  groups: z.array(GroupSchema),
  blocks: z.array(BlockSchema),
  files: z.array(FileSchema),
  sources: z.array(SourceSchema),
  tools: z.array(letta__schemas__agent_file__ToolSchema),
  mcp_servers: z.array(MCPServerSchema),
  metadata: z.union([z.unknown(), z.undefined()]).optional(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type Block = z.infer<typeof Block>;
export const Block = z.object({
  value: z.string(),
  limit: z.union([z.number(), z.undefined()]).optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_template: z.union([z.boolean(), z.undefined()]).optional(),
  base_template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  deployment_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  entity_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  preserve_on_migration: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  label: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  read_only: z.union([z.boolean(), z.undefined()]).optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type FileBlock = z.infer<typeof FileBlock>;
export const FileBlock = z.object({
  value: z.string(),
  limit: z.union([z.number(), z.undefined()]).optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_template: z.union([z.boolean(), z.undefined()]).optional(),
  base_template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  deployment_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  entity_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  preserve_on_migration: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  label: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  read_only: z.union([z.boolean(), z.undefined()]).optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_id: z.string(),
  source_id: z.string(),
  is_open: z.boolean(),
  last_accessed_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type Memory = z.infer<typeof Memory>;
export const Memory = z.object({
  agent_type: z
    .union([
      AgentType,
      z.string(),
      z.null(),
      z.array(z.union([AgentType, z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  blocks: z.array(Block),
  file_blocks: z.union([z.array(FileBlock), z.undefined()]).optional(),
  prompt_template: z.union([z.string(), z.undefined()]).optional(),
});

export type Tool = z.infer<typeof Tool>;
export const Tool = z.object({
  id: z.string().optional(),
  tool_type: ToolType.optional(),
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  source_type: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  tags: z.array(z.string()).optional(),
  source_code: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  json_schema: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  args_json_schema: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  return_char_limit: z.number().optional(),
  pip_requirements: z
    .union([
      z.array(PipRequirement),
      z.null(),
      z.array(z.union([z.array(PipRequirement), z.null()])),
    ])
    .optional(),
  npm_requirements: z
    .union([
      z.array(NpmRequirement),
      z.null(),
      z.array(z.union([z.array(NpmRequirement), z.null()])),
    ])
    .optional(),
  default_requires_approval: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  created_by_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  last_updated_by_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  metadata_: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
});

export type VectorDBProvider = z.infer<typeof VectorDBProvider>;
export const VectorDBProvider = z.union([
  z.literal('native'),
  z.literal('tpuf'),
  z.literal('pinecone'),
]);

export type Source = z.infer<typeof Source>;
export const Source = z.object({
  name: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  instructions: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  embedding_config: EmbeddingConfig,
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  vector_db_provider: z.union([VectorDBProvider, z.undefined()]).optional(),
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ManagerType = z.infer<typeof ManagerType>;
export const ManagerType = z.union([
  z.literal('round_robin'),
  z.literal('supervisor'),
  z.literal('dynamic'),
  z.literal('sleeptime'),
  z.literal('voice_sleeptime'),
  z.literal('swarm'),
]);

export type Group = z.infer<typeof Group>;
export const Group = z.object({
  id: z.string(),
  manager_type: ManagerType,
  agent_ids: z.array(z.string()),
  description: z.string(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  deployment_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  shared_block_ids: z.union([z.array(z.string()), z.undefined()]).optional(),
  manager_agent_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  termination_token: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_turns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sleeptime_agent_frequency: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  turns_counter: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_processed_message_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_message_buffer_length: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  min_message_buffer_length: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type AgentState = z.infer<typeof AgentState>;
export const AgentState = z.object({
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.string(),
  name: z.string(),
  tool_rules: z
    .union([
      z.array(
        z.union([
          ChildToolRule,
          InitToolRule,
          TerminalToolRule,
          ConditionalToolRule,
          ContinueToolRule,
          RequiredBeforeExitToolRule,
          MaxCountPerStepToolRule,
          ParentToolRule,
          RequiresApprovalToolRule,
        ]),
      ),
      z.null(),
      z.array(
        z.union([
          z.array(
            z.union([
              ChildToolRule,
              InitToolRule,
              TerminalToolRule,
              ConditionalToolRule,
              ContinueToolRule,
              RequiredBeforeExitToolRule,
              MaxCountPerStepToolRule,
              ParentToolRule,
              RequiresApprovalToolRule,
            ]),
          ),
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  message_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  system: z.string(),
  agent_type: AgentType,
  llm_config: LLMConfig,
  embedding_config: EmbeddingConfig,
  response_format: z
    .union([
      TextResponseFormat,
      JsonSchemaResponseFormat,
      JsonObjectResponseFormat,
      z.null(),
      z.array(
        z.union([
          TextResponseFormat,
          JsonSchemaResponseFormat,
          JsonObjectResponseFormat,
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  memory: Memory,
  tools: z.array(Tool),
  sources: z.array(Source),
  tags: z.array(z.string()),
  tool_exec_environment_variables: z
    .union([z.array(AgentEnvironmentVariable), z.undefined()])
    .optional(),
  secrets: z
    .union([z.array(AgentEnvironmentVariable), z.undefined()])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  deployment_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  entity_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  identity_ids: z.union([z.array(z.string()), z.undefined()]).optional(),
  message_buffer_autoclear: z.union([z.boolean(), z.undefined()]).optional(),
  enable_sleeptime: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  multi_agent_group: z
    .union([
      Group,
      z.null(),
      z.array(z.union([Group, z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_run_completion: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_run_duration_ms: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  timezone: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_files_open: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  per_file_view_window_char_limit: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type AuthSchemeField = z.infer<typeof AuthSchemeField>;
export const AuthSchemeField = z.object({
  name: z.string(),
  display_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  description: z.string(),
  type: z.string(),
  default: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  required: z.union([z.boolean(), z.undefined()]).optional(),
  expected_from_customer: z.union([z.boolean(), z.undefined()]).optional(),
  get_current_user_endpoint: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type AppAuthScheme = z.infer<typeof AppAuthScheme>;
export const AppAuthScheme = z.object({
  scheme_name: z.string(),
  auth_mode: z.union([
    z.literal('OAUTH2'),
    z.literal('OAUTH1'),
    z.literal('API_KEY'),
    z.literal('BASIC'),
    z.literal('BEARER_TOKEN'),
    z.literal('BASIC_WITH_JWT'),
    z.literal('GOOGLE_SERVICE_ACCOUNT'),
    z.literal('GOOGLEADS_AUTH'),
    z.literal('NO_AUTH'),
    z.literal('CALCOM_AUTH'),
  ]),
  fields: z.array(AuthSchemeField),
  proxy: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  authorization_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  token_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  default_scopes: z
    .union([
      z.array(z.unknown()),
      z.null(),
      z.array(z.union([z.array(z.unknown()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  token_response_metadata: z
    .union([
      z.array(z.unknown()),
      z.null(),
      z.array(z.union([z.array(z.unknown()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  client_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  client_secret: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type AppModel = z.infer<typeof AppModel>;
export const AppModel = z.object({
  name: z.string(),
  key: z.string(),
  appId: z.string(),
  description: z.string(),
  categories: z.array(z.string()),
  meta: z.unknown(),
  logo: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  docs: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  group: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  status: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enabled: z.union([z.boolean(), z.undefined()]).optional(),
  no_auth: z.union([z.boolean(), z.undefined()]).optional(),
  auth_schemes: z
    .union([
      z.array(AppAuthScheme),
      z.null(),
      z.array(z.union([z.array(AppAuthScheme), z.null()])),
      z.undefined(),
    ])
    .optional(),
  testConnectors: z
    .union([
      z.array(z.unknown()),
      z.null(),
      z.array(z.union([z.array(z.unknown()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  documentation_doc_text: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  configuration_docs_text: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ApprovalCreate = z.infer<typeof ApprovalCreate>;
export const ApprovalCreate = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  approve: z.boolean(),
  approval_request_id: z.string(),
  reason: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ToolCall = z.infer<typeof ToolCall>;
export const ToolCall = z.object({
  name: z.string(),
  arguments: z.string(),
  tool_call_id: z.string(),
});

export type ToolCallDelta = z.infer<typeof ToolCallDelta>;
export const ToolCallDelta = z.object({
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  arguments: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  tool_call_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
});

export type ApprovalRequestMessage = z.infer<typeof ApprovalRequestMessage>;
export const ApprovalRequestMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_call: z.union([
    ToolCall,
    ToolCallDelta,
    z.array(z.union([ToolCall, ToolCallDelta])),
  ]),
});

export type ApprovalResponseMessage = z.infer<typeof ApprovalResponseMessage>;
export const ApprovalResponseMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  approve: z.boolean(),
  approval_request_id: z.string(),
  reason: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ArchivalMemorySearchResult = z.infer<
  typeof ArchivalMemorySearchResult
>;
export const ArchivalMemorySearchResult = z.object({
  timestamp: z.string(),
  content: z.string(),
  tags: z.union([z.array(z.string()), z.undefined()]).optional(),
});

export type ArchivalMemorySearchResponse = z.infer<
  typeof ArchivalMemorySearchResponse
>;
export const ArchivalMemorySearchResponse = z.object({
  results: z.array(ArchivalMemorySearchResult),
  count: z.number(),
});

export type Archive = z.infer<typeof Archive>;
export const Archive = z.object({
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z.string(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  organization_id: z.string(),
  vector_db_provider: z.union([VectorDBProvider, z.undefined()]).optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
});

export type ArchiveCreateRequest = z.infer<typeof ArchiveCreateRequest>;
export const ArchiveCreateRequest = z.object({
  name: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ArchiveUpdateRequest = z.infer<typeof ArchiveUpdateRequest>;
export const ArchiveUpdateRequest = z.object({
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
});

export type LettaAssistantMessageContentUnion = z.infer<
  typeof LettaAssistantMessageContentUnion
>;
export const LettaAssistantMessageContentUnion = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  text: z.string(),
});

export type AssistantMessage = z.infer<typeof AssistantMessage>;
export const AssistantMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  content: z.union([
    z.array(TextContent),
    z.string(),
    z.array(z.union([z.array(TextContent), z.string()])),
  ]),
});

export type AuthRequest = z.infer<typeof AuthRequest>;
export const AuthRequest = z.object({
  password: z.string().optional(),
});

export type AuthResponse = z.infer<typeof AuthResponse>;
export const AuthResponse = z.object({
  uuid: z.string(),
  is_admin: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type BaseToolRuleSchema = z.infer<typeof BaseToolRuleSchema>;
export const BaseToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.string(),
});

export type JobStatus = z.infer<typeof JobStatus>;
export const JobStatus = z.union([
  z.literal('created'),
  z.literal('running'),
  z.literal('completed'),
  z.literal('failed'),
  z.literal('pending'),
  z.literal('cancelled'),
  z.literal('expired'),
]);

export type StopReasonType = z.infer<typeof StopReasonType>;
export const StopReasonType = z.union([
  z.literal('end_turn'),
  z.literal('error'),
  z.literal('llm_api_error'),
  z.literal('invalid_llm_response'),
  z.literal('invalid_tool_call'),
  z.literal('max_steps'),
  z.literal('no_tool_call'),
  z.literal('tool_rule'),
  z.literal('cancelled'),
  z.literal('requires_approval'),
]);

export type JobType = z.infer<typeof JobType>;
export const JobType = z.union([
  z.literal('job'),
  z.literal('run'),
  z.literal('batch'),
]);

export type BatchJob = z.infer<typeof BatchJob>;
export const BatchJob = z.object({
  created_by_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  last_updated_by_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  created_at: z.string().optional(),
  updated_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  status: JobStatus.optional(),
  completed_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  stop_reason: z
    .union([
      StopReasonType,
      z.null(),
      z.array(z.union([StopReasonType, z.null()])),
    ])
    .optional(),
  metadata: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  job_type: JobType.optional(),
  background: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  agent_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  callback_url: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  callback_sent_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  callback_status_code: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  callback_error: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  ttft_ns: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  total_duration_ns: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  id: z.string().optional(),
  user_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
});

export type BlockUpdate = z.infer<typeof BlockUpdate>;
export const BlockUpdate = z.object({
  value: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  limit: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  project_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  is_template: z.boolean().optional(),
  base_template_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  deployment_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  entity_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  preserve_on_migration: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  label: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  read_only: z.boolean().optional(),
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  metadata: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  hidden: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
});

export type CoreMemoryBlockSchema = z.infer<typeof CoreMemoryBlockSchema>;
export const CoreMemoryBlockSchema = z.object({
  created_at: z.string(),
  description: z.union([
    z.string(),
    z.null(),
    z.array(z.union([z.string(), z.null()])),
  ]),
  is_template: z.boolean(),
  label: z.string(),
  limit: z.number(),
  metadata_: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  template_name: z.union([
    z.string(),
    z.null(),
    z.array(z.union([z.string(), z.null()])),
  ]),
  updated_at: z.string(),
  value: z.string(),
});

export type letta__serialize_schemas__pydantic_agent_schema__MessageSchema =
  z.infer<
    typeof letta__serialize_schemas__pydantic_agent_schema__MessageSchema
  >;
export const letta__serialize_schemas__pydantic_agent_schema__MessageSchema =
  z.object({
    created_at: z.string(),
    group_id: z.union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
    ]),
    model: z.union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
    ]),
    name: z.union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
    ]),
    role: z.string(),
    content: z.array(LettaMessageContentUnion),
    tool_call_id: z.union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
    ]),
    tool_calls: z.array(z.unknown()),
    tool_returns: z.array(z.unknown()),
    updated_at: z.string(),
  });

export type TagSchema = z.infer<typeof TagSchema>;
export const TagSchema = z.object({
  tag: z.string(),
});

export type ToolEnvVarSchema = z.infer<typeof ToolEnvVarSchema>;
export const ToolEnvVarSchema = z.object({
  created_at: z.string(),
  description: z.union([
    z.string(),
    z.null(),
    z.array(z.union([z.string(), z.null()])),
  ]),
  key: z.string(),
  updated_at: z.string(),
  value: z.string(),
});

export type ChildToolRuleSchema = z.infer<typeof ChildToolRuleSchema>;
export const ChildToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.string(),
  children: z.array(z.string()),
});

export type MaxCountPerStepToolRuleSchema = z.infer<
  typeof MaxCountPerStepToolRuleSchema
>;
export const MaxCountPerStepToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.string(),
  max_count_limit: z.number(),
});

export type ConditionalToolRuleSchema = z.infer<
  typeof ConditionalToolRuleSchema
>;
export const ConditionalToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.string(),
  default_child: z.union([
    z.string(),
    z.null(),
    z.array(z.union([z.string(), z.null()])),
  ]),
  child_output_mapping: z.unknown(),
  require_output_mapping: z.boolean(),
});

export type ParameterProperties = z.infer<typeof ParameterProperties>;
export const ParameterProperties = z.object({
  type: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ParametersSchema = z.infer<typeof ParametersSchema>;
export const ParametersSchema = z.object({
  type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  properties: z.unknown(),
  required: z.union([z.array(z.string()), z.undefined()]).optional(),
});

export type ToolJSONSchema = z.infer<typeof ToolJSONSchema>;
export const ToolJSONSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: ParametersSchema,
  type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  required: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type letta__serialize_schemas__pydantic_agent_schema__ToolSchema =
  z.infer<typeof letta__serialize_schemas__pydantic_agent_schema__ToolSchema>;
export const letta__serialize_schemas__pydantic_agent_schema__ToolSchema =
  z.object({
    args_json_schema: z.union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
    ]),
    created_at: z.string(),
    description: z.string(),
    json_schema: ToolJSONSchema,
    name: z.string(),
    return_char_limit: z.number(),
    source_code: z.union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
    ]),
    source_type: z.string(),
    tags: z.array(z.string()),
    tool_type: z.string(),
    updated_at: z.string(),
    metadata_: z
      .union([
        z.unknown(),
        z.null(),
        z.array(z.union([z.unknown(), z.null()])),
        z.undefined(),
      ])
      .optional(),
  });

export type letta__serialize_schemas__pydantic_agent_schema__AgentSchema =
  z.infer<typeof letta__serialize_schemas__pydantic_agent_schema__AgentSchema>;
export const letta__serialize_schemas__pydantic_agent_schema__AgentSchema =
  z.object({
    agent_type: z.string(),
    core_memory: z.array(CoreMemoryBlockSchema),
    created_at: z.string(),
    description: z.union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
    ]),
    embedding_config: EmbeddingConfig,
    llm_config: LLMConfig,
    message_buffer_autoclear: z.boolean(),
    in_context_message_indices: z.array(z.number()),
    messages: z.array(
      letta__serialize_schemas__pydantic_agent_schema__MessageSchema,
    ),
    metadata_: z
      .union([
        z.unknown(),
        z.null(),
        z.array(z.union([z.unknown(), z.null()])),
        z.undefined(),
      ])
      .optional(),
    multi_agent_group: z.union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
    ]),
    name: z.string(),
    system: z.string(),
    tags: z.array(TagSchema),
    tool_exec_environment_variables: z.array(ToolEnvVarSchema),
    tool_rules: z.array(
      z.union([
        BaseToolRuleSchema,
        ChildToolRuleSchema,
        MaxCountPerStepToolRuleSchema,
        ConditionalToolRuleSchema,
        z.array(
          z.union([
            BaseToolRuleSchema,
            ChildToolRuleSchema,
            MaxCountPerStepToolRuleSchema,
            ConditionalToolRuleSchema,
          ]),
        ),
      ]),
    ),
    tools: z.array(letta__serialize_schemas__pydantic_agent_schema__ToolSchema),
    updated_at: z.string(),
    version: z.string(),
  });

export type Body_export_agent = z.infer<typeof Body_export_agent>;
export const Body_export_agent = z.object({
  spec: z
    .union([
      AgentFileSchema,
      z.null(),
      z.array(z.union([AgentFileSchema, z.null()])),
    ])
    .optional(),
  legacy_spec: z
    .union([
      letta__serialize_schemas__pydantic_agent_schema__AgentSchema,
      z.null(),
      z.array(
        z.union([
          letta__serialize_schemas__pydantic_agent_schema__AgentSchema,
          z.null(),
        ]),
      ),
    ])
    .optional(),
});

export type Body_import_agent = z.infer<typeof Body_import_agent>;
export const Body_import_agent = z.object({
  file: z.string(),
  append_copy_suffix: z.union([z.boolean(), z.undefined()]).optional(),
  override_existing_tools: z.union([z.boolean(), z.undefined()]).optional(),
  override_embedding_handle: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  strip_messages: z.union([z.boolean(), z.undefined()]).optional(),
  env_vars_json: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type Body_upload_file_to_folder = z.infer<
  typeof Body_upload_file_to_folder
>;
export const Body_upload_file_to_folder = z.object({
  file: z.string(),
});

export type Body_upload_file_to_source = z.infer<
  typeof Body_upload_file_to_source
>;
export const Body_upload_file_to_source = z.object({
  file: z.string(),
});

export type CancelAgentRunRequest = z.infer<typeof CancelAgentRunRequest>;
export const CancelAgentRunRequest = z.object({
  run_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
});

export type CodeInput = z.infer<typeof CodeInput>;
export const CodeInput = z.object({
  code: z.string(),
  source_type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type FunctionDefinition = z.infer<typeof FunctionDefinition>;
export const FunctionDefinition = z.intersection(
  z.object({
    name: z.string(),
    description: z
      .union([
        z.string(),
        z.null(),
        z.array(z.union([z.string(), z.null()])),
        z.undefined(),
      ])
      .optional(),
    parameters: z
      .union([
        z.unknown(),
        z.null(),
        z.array(z.union([z.unknown(), z.null()])),
        z.undefined(),
      ])
      .optional(),
    strict: z
      .union([
        z.boolean(),
        z.null(),
        z.array(z.union([z.boolean(), z.null()])),
        z.undefined(),
      ])
      .optional(),
  }),
  z.object({
    string: z.any(),
  }),
);

export type FunctionTool = z.infer<typeof FunctionTool>;
export const FunctionTool = z.intersection(
  z.object({
    function: FunctionDefinition,
    type: z.string(),
  }),
  z.object({
    string: z.any(),
  }),
);

export type SummarizedReasoningContentPart = z.infer<
  typeof SummarizedReasoningContentPart
>;
export const SummarizedReasoningContentPart = z.object({
  index: z.number(),
  text: z.string(),
});

export type SummarizedReasoningContent = z.infer<
  typeof SummarizedReasoningContent
>;
export const SummarizedReasoningContent = z.object({
  type: z.union([z.string(), z.undefined()]).optional(),
  id: z.string(),
  summary: z.array(SummarizedReasoningContentPart),
  encrypted_content: z.union([z.string(), z.undefined()]).optional(),
});

export type Message = z.infer<typeof Message>;
export const Message = z.object({
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z.union([z.string(), z.undefined()]).optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  agent_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  model: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  role: MessageRole,
  content: z
    .union([
      z.array(
        z.union([
          TextContent,
          ImageContent,
          ToolCallContent,
          ToolReturnContent,
          ReasoningContent,
          RedactedReasoningContent,
          OmittedReasoningContent,
          SummarizedReasoningContent,
        ]),
      ),
      z.null(),
      z.array(
        z.union([
          z.array(
            z.union([
              TextContent,
              ImageContent,
              ToolCallContent,
              ToolReturnContent,
              ReasoningContent,
              RedactedReasoningContent,
              OmittedReasoningContent,
              SummarizedReasoningContent,
            ]),
          ),
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_calls: z
    .union([
      z.array(ChatCompletionMessageFunctionToolCall),
      z.null(),
      z.array(
        z.union([z.array(ChatCompletionMessageFunctionToolCall), z.null()]),
      ),
      z.undefined(),
    ])
    .optional(),
  tool_call_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_returns: z
    .union([
      z.array(ToolReturn),
      z.null(),
      z.array(z.union([z.array(ToolReturn), z.null()])),
      z.undefined(),
    ])
    .optional(),
  group_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  batch_item_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  approval_request_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  approve: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  denial_reason: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ContextWindowOverview = z.infer<typeof ContextWindowOverview>;
export const ContextWindowOverview = z.object({
  context_window_size_max: z.number(),
  context_window_size_current: z.number(),
  num_messages: z.number(),
  num_archival_memory: z.number(),
  num_recall_memory: z.number(),
  num_tokens_external_memory_summary: z.number(),
  external_memory_summary: z.string(),
  num_tokens_system: z.number(),
  system_prompt: z.string(),
  num_tokens_core_memory: z.number(),
  core_memory: z.string(),
  num_tokens_summary_memory: z.number(),
  summary_memory: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  num_tokens_functions_definitions: z.number(),
  functions_definitions: z.union([
    z.array(FunctionTool),
    z.null(),
    z.array(z.union([z.array(FunctionTool), z.null()])),
  ]),
  num_tokens_messages: z.number(),
  messages: z.array(Message),
});

export type CreateAgentRequest = z.infer<typeof CreateAgentRequest>;
export const CreateAgentRequest = z.object({
  name: z.string().optional(),
  memory_blocks: z
    .union([
      z.array(CreateBlock),
      z.null(),
      z.array(z.union([z.array(CreateBlock), z.null()])),
    ])
    .optional(),
  tools: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  tool_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  source_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  block_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  tool_rules: z
    .union([
      z.array(
        z.union([
          ChildToolRule,
          InitToolRule,
          TerminalToolRule,
          ConditionalToolRule,
          ContinueToolRule,
          RequiredBeforeExitToolRule,
          MaxCountPerStepToolRule,
          ParentToolRule,
          RequiresApprovalToolRule,
        ]),
      ),
      z.null(),
      z.array(
        z.union([
          z.array(
            z.union([
              ChildToolRule,
              InitToolRule,
              TerminalToolRule,
              ConditionalToolRule,
              ContinueToolRule,
              RequiredBeforeExitToolRule,
              MaxCountPerStepToolRule,
              ParentToolRule,
              RequiresApprovalToolRule,
            ]),
          ),
          z.null(),
        ]),
      ),
    ])
    .optional(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  system: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  agent_type: AgentType.optional(),
  llm_config: z
    .union([LLMConfig, z.null(), z.array(z.union([LLMConfig, z.null()]))])
    .optional(),
  embedding_config: z
    .union([
      EmbeddingConfig,
      z.null(),
      z.array(z.union([EmbeddingConfig, z.null()])),
    ])
    .optional(),
  initial_message_sequence: z
    .union([
      z.array(MessageCreate),
      z.null(),
      z.array(z.union([z.array(MessageCreate), z.null()])),
    ])
    .optional(),
  include_base_tools: z.boolean().optional(),
  include_multi_agent_tools: z.boolean().optional(),
  include_base_tool_rules: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  include_default_source: z.boolean().optional(),
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  metadata: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  model: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  embedding: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  context_window_limit: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  embedding_chunk_size: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  max_tokens: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  max_reasoning_tokens: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  enable_reasoner: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  reasoning: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  from_template: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  template: z.boolean().optional(),
  project: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  tool_exec_environment_variables: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  secrets: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  memory_variables: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  project_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  template_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  base_template_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  identity_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  message_buffer_autoclear: z.boolean().optional(),
  enable_sleeptime: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  response_format: z
    .union([
      TextResponseFormat,
      JsonSchemaResponseFormat,
      JsonObjectResponseFormat,
      z.null(),
      z.array(
        z.union([
          TextResponseFormat,
          JsonSchemaResponseFormat,
          JsonObjectResponseFormat,
          z.null(),
        ]),
      ),
    ])
    .optional(),
  timezone: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  max_files_open: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  per_file_view_window_char_limit: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  hidden: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  actor_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
});

export type CreateArchivalMemory = z.infer<typeof CreateArchivalMemory>;
export const CreateArchivalMemory = z.object({
  text: z.string(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type MessageType = z.infer<typeof MessageType>;
export const MessageType = z.union([
  z.literal('system_message'),
  z.literal('user_message'),
  z.literal('assistant_message'),
  z.literal('reasoning_message'),
  z.literal('hidden_reasoning_message'),
  z.literal('tool_call_message'),
  z.literal('tool_return_message'),
  z.literal('approval_request_message'),
  z.literal('approval_response_message'),
]);

export type LettaBatchRequest = z.infer<typeof LettaBatchRequest>;
export const LettaBatchRequest = z.object({
  messages: z.array(
    z.union([
      MessageCreate,
      ApprovalCreate,
      z.array(z.union([MessageCreate, ApprovalCreate])),
    ]),
  ),
  max_steps: z.union([z.number(), z.undefined()]).optional(),
  use_assistant_message: z.union([z.boolean(), z.undefined()]).optional(),
  assistant_message_tool_name: z.union([z.string(), z.undefined()]).optional(),
  assistant_message_tool_kwarg: z.union([z.string(), z.undefined()]).optional(),
  include_return_message_types: z
    .union([
      z.array(MessageType),
      z.null(),
      z.array(z.union([z.array(MessageType), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enable_thinking: z.union([z.string(), z.undefined()]).optional(),
  agent_id: z.string(),
});

export type CreateBatch = z.infer<typeof CreateBatch>;
export const CreateBatch = z.object({
  requests: z.array(LettaBatchRequest),
  callback_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type DeleteDeploymentResponse = z.infer<typeof DeleteDeploymentResponse>;
export const DeleteDeploymentResponse = z.object({
  deleted_blocks: z.union([z.array(z.string()), z.undefined()]).optional(),
  deleted_agents: z.union([z.array(z.string()), z.undefined()]).optional(),
  deleted_groups: z.union([z.array(z.string()), z.undefined()]).optional(),
  message: z.string(),
});

export type DeploymentEntity = z.infer<typeof DeploymentEntity>;
export const DeploymentEntity = z.object({
  id: z.string(),
  type: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  entity_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type DuplicateFileHandling = z.infer<typeof DuplicateFileHandling>;
export const DuplicateFileHandling = z.union([
  z.literal('skip'),
  z.literal('error'),
  z.literal('suffix'),
  z.literal('replace'),
]);

export type DynamicManagerUpdate = z.infer<typeof DynamicManagerUpdate>;
export const DynamicManagerUpdate = z.object({
  manager_type: z.string().optional(),
  manager_agent_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  termination_token: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  max_turns: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
});

export type E2BSandboxConfig = z.infer<typeof E2BSandboxConfig>;
export const E2BSandboxConfig = z.object({
  timeout: z.number().optional(),
  template: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  pip_requirements: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
});

export type FeedbackType = z.infer<typeof FeedbackType>;
export const FeedbackType = z.union([
  z.literal('positive'),
  z.literal('negative'),
]);

export type FileMetadata = z.infer<typeof FileMetadata>;
export const FileMetadata = z.object({
  source_id: z.string(),
  file_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  original_file_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_path: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_size: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_creation_date: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_last_modified_date: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  processing_status: z.union([FileProcessingStatus, z.undefined()]).optional(),
  error_message: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  total_chunks: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  chunks_embedded: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  content: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type FileStats = z.infer<typeof FileStats>;
export const FileStats = z.object({
  file_id: z.string(),
  file_name: z.string(),
  file_size: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type Folder = z.infer<typeof Folder>;
export const Folder = z.object({
  name: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  instructions: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  embedding_config: EmbeddingConfig,
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type GenerateToolInput = z.infer<typeof GenerateToolInput>;
export const GenerateToolInput = z.object({
  tool_name: z.string(),
  prompt: z.string(),
  handle: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  starter_code: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  validation_errors: z.array(z.string()),
});

export type GenerateToolOutput = z.infer<typeof GenerateToolOutput>;
export const GenerateToolOutput = z.object({
  tool: Tool,
  sample_args: z.unknown(),
  response: z.string(),
});

export type GroupCreate = z.infer<typeof GroupCreate>;
export const GroupCreate = z.object({
  agent_ids: z.array(z.string()),
  description: z.string(),
  manager_config: z
    .union([
      RoundRobinManager,
      SupervisorManager,
      DynamicManager,
      SleeptimeManager,
      VoiceSleeptimeManager,
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  shared_block_ids: z.union([z.array(z.string()), z.undefined()]).optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type RoundRobinManagerUpdate = z.infer<typeof RoundRobinManagerUpdate>;
export const RoundRobinManagerUpdate = z.object({
  manager_type: z.string().optional(),
  max_turns: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
});

export type SupervisorManagerUpdate = z.infer<typeof SupervisorManagerUpdate>;
export const SupervisorManagerUpdate = z.object({
  manager_type: z.union([z.string(), z.undefined()]).optional(),
  manager_agent_id: z.union([
    z.string(),
    z.null(),
    z.array(z.union([z.string(), z.null()])),
  ]),
});

export type SleeptimeManagerUpdate = z.infer<typeof SleeptimeManagerUpdate>;
export const SleeptimeManagerUpdate = z.object({
  manager_type: z.string().optional(),
  manager_agent_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  sleeptime_agent_frequency: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
});

export type VoiceSleeptimeManagerUpdate = z.infer<
  typeof VoiceSleeptimeManagerUpdate
>;
export const VoiceSleeptimeManagerUpdate = z.object({
  manager_type: z.string().optional(),
  manager_agent_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  max_message_buffer_length: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  min_message_buffer_length: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
});

export type GroupUpdate = z.infer<typeof GroupUpdate>;
export const GroupUpdate = z.object({
  agent_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  manager_config: z
    .union([
      RoundRobinManagerUpdate,
      SupervisorManagerUpdate,
      DynamicManagerUpdate,
      SleeptimeManagerUpdate,
      VoiceSleeptimeManagerUpdate,
      z.null(),
      z.array(
        z.union([
          RoundRobinManagerUpdate,
          SupervisorManagerUpdate,
          DynamicManagerUpdate,
          SleeptimeManagerUpdate,
          VoiceSleeptimeManagerUpdate,
          z.null(),
        ]),
      ),
    ])
    .optional(),
  project_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  shared_block_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
});

export type ValidationError = z.infer<typeof ValidationError>;
export const ValidationError = z.object({
  loc: z.array(
    z.union([
      z.string(),
      z.number(),
      z.array(z.union([z.string(), z.number()])),
    ]),
  ),
  msg: z.string(),
  type: z.string(),
});

export type HTTPValidationError = z.infer<typeof HTTPValidationError>;
export const HTTPValidationError = z.object({
  detail: z.array(ValidationError).optional(),
});

export type Health = z.infer<typeof Health>;
export const Health = z.object({
  version: z.string(),
  status: z.string(),
});

export type HiddenReasoningMessage = z.infer<typeof HiddenReasoningMessage>;
export const HiddenReasoningMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  state: z.union([z.literal('redacted'), z.literal('omitted')]),
  hidden_reasoning: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type IdentityType = z.infer<typeof IdentityType>;
export const IdentityType = z.union([
  z.literal('org'),
  z.literal('user'),
  z.literal('other'),
]);

export type IdentityPropertyType = z.infer<typeof IdentityPropertyType>;
export const IdentityPropertyType = z.union([
  z.literal('string'),
  z.literal('number'),
  z.literal('boolean'),
  z.literal('json'),
]);

export type IdentityProperty = z.infer<typeof IdentityProperty>;
export const IdentityProperty = z.object({
  key: z.string(),
  value: z.union([
    z.string(),
    z.number(),
    z.number(),
    z.boolean(),
    z.unknown(),
    z.array(
      z.union([z.string(), z.number(), z.number(), z.boolean(), z.unknown()]),
    ),
  ]),
  type: IdentityPropertyType,
});

export type Identity = z.infer<typeof Identity>;
export const Identity = z.object({
  id: z.union([z.string(), z.undefined()]).optional(),
  identifier_key: z.string(),
  name: z.string(),
  identity_type: IdentityType,
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_ids: z.array(z.string()),
  block_ids: z.array(z.string()),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  properties: z.union([z.array(IdentityProperty), z.undefined()]).optional(),
});

export type IdentityCreate = z.infer<typeof IdentityCreate>;
export const IdentityCreate = z.object({
  identifier_key: z.string(),
  name: z.string(),
  identity_type: IdentityType,
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  block_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  properties: z
    .union([
      z.array(IdentityProperty),
      z.null(),
      z.array(z.union([z.array(IdentityProperty), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type IdentityUpdate = z.infer<typeof IdentityUpdate>;
export const IdentityUpdate = z.object({
  identifier_key: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  identity_type: z
    .union([IdentityType, z.null(), z.array(z.union([IdentityType, z.null()]))])
    .optional(),
  agent_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  block_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  properties: z
    .union([
      z.array(IdentityProperty),
      z.null(),
      z.array(z.union([z.array(IdentityProperty), z.null()])),
    ])
    .optional(),
});

export type IdentityUpsert = z.infer<typeof IdentityUpsert>;
export const IdentityUpsert = z.object({
  identifier_key: z.string(),
  name: z.string(),
  identity_type: IdentityType,
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  block_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  properties: z
    .union([
      z.array(IdentityProperty),
      z.null(),
      z.array(z.union([z.array(IdentityProperty), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ImportedAgentsResponse = z.infer<typeof ImportedAgentsResponse>;
export const ImportedAgentsResponse = z.object({
  agent_ids: z.array(z.string()),
});

export type InternalTemplateAgentCreate = z.infer<
  typeof InternalTemplateAgentCreate
>;
export const InternalTemplateAgentCreate = z.object({
  name: z.union([z.string(), z.undefined()]).optional(),
  memory_blocks: z
    .union([
      z.array(CreateBlock),
      z.null(),
      z.array(z.union([z.array(CreateBlock), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tools: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  source_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  block_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_rules: z
    .union([
      z.array(
        z.union([
          ChildToolRule,
          InitToolRule,
          TerminalToolRule,
          ConditionalToolRule,
          ContinueToolRule,
          RequiredBeforeExitToolRule,
          MaxCountPerStepToolRule,
          ParentToolRule,
          RequiresApprovalToolRule,
        ]),
      ),
      z.null(),
      z.array(
        z.union([
          z.array(
            z.union([
              ChildToolRule,
              InitToolRule,
              TerminalToolRule,
              ConditionalToolRule,
              ContinueToolRule,
              RequiredBeforeExitToolRule,
              MaxCountPerStepToolRule,
              ParentToolRule,
              RequiresApprovalToolRule,
            ]),
          ),
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  system: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_type: z.union([AgentType, z.undefined()]).optional(),
  llm_config: z
    .union([
      LLMConfig,
      z.null(),
      z.array(z.union([LLMConfig, z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_config: z
    .union([
      EmbeddingConfig,
      z.null(),
      z.array(z.union([EmbeddingConfig, z.null()])),
      z.undefined(),
    ])
    .optional(),
  initial_message_sequence: z
    .union([
      z.array(MessageCreate),
      z.null(),
      z.array(z.union([z.array(MessageCreate), z.null()])),
      z.undefined(),
    ])
    .optional(),
  include_base_tools: z.union([z.boolean(), z.undefined()]).optional(),
  include_multi_agent_tools: z.union([z.boolean(), z.undefined()]).optional(),
  include_base_tool_rules: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  include_default_source: z.union([z.boolean(), z.undefined()]).optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  model: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  context_window_limit: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_chunk_size: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_tokens: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_reasoning_tokens: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enable_reasoner: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  reasoning: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  from_template: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  template: z.union([z.boolean(), z.undefined()]).optional(),
  project: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_exec_environment_variables: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  secrets: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  memory_variables: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  template_id: z.string(),
  base_template_id: z.string(),
  identity_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_buffer_autoclear: z.union([z.boolean(), z.undefined()]).optional(),
  enable_sleeptime: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  response_format: z
    .union([
      TextResponseFormat,
      JsonSchemaResponseFormat,
      JsonObjectResponseFormat,
      z.null(),
      z.array(
        z.union([
          TextResponseFormat,
          JsonSchemaResponseFormat,
          JsonObjectResponseFormat,
          z.null(),
        ]),
      ),
      z.undefined(),
    ])
    .optional(),
  timezone: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  max_files_open: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  per_file_view_window_char_limit: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  deployment_id: z.string(),
  entity_id: z.string(),
});

export type InternalTemplateBlockCreate = z.infer<
  typeof InternalTemplateBlockCreate
>;
export const InternalTemplateBlockCreate = z.object({
  value: z.string(),
  limit: z.union([z.number(), z.undefined()]).optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_template: z.union([z.boolean(), z.undefined()]).optional(),
  template_id: z.string(),
  base_template_id: z.string(),
  deployment_id: z.string(),
  entity_id: z.string(),
  preserve_on_migration: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  label: z.string(),
  read_only: z.union([z.boolean(), z.undefined()]).optional(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type InternalTemplateGroupCreate = z.infer<
  typeof InternalTemplateGroupCreate
>;
export const InternalTemplateGroupCreate = z.object({
  agent_ids: z.array(z.string()),
  description: z.string(),
  manager_config: z
    .union([
      RoundRobinManager,
      SupervisorManager,
      DynamicManager,
      SleeptimeManager,
      VoiceSleeptimeManager,
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  shared_block_ids: z.union([z.array(z.string()), z.undefined()]).optional(),
  hidden: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_template_id: z.string(),
  template_id: z.string(),
  deployment_id: z.string(),
});

export type Job = z.infer<typeof Job>;
export const Job = z.object({
  created_by_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  last_updated_by_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  created_at: z.string().optional(),
  updated_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  status: JobStatus.optional(),
  completed_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  stop_reason: z
    .union([
      StopReasonType,
      z.null(),
      z.array(z.union([StopReasonType, z.null()])),
    ])
    .optional(),
  metadata: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  job_type: JobType.optional(),
  background: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  agent_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  callback_url: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  callback_sent_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  callback_status_code: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  callback_error: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  ttft_ns: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  total_duration_ns: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  id: z.string().optional(),
  user_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
});

export type LettaAsyncRequest = z.infer<typeof LettaAsyncRequest>;
export const LettaAsyncRequest = z.object({
  messages: z.array(
    z.union([
      MessageCreate,
      ApprovalCreate,
      z.array(z.union([MessageCreate, ApprovalCreate])),
    ]),
  ),
  max_steps: z.union([z.number(), z.undefined()]).optional(),
  use_assistant_message: z.union([z.boolean(), z.undefined()]).optional(),
  assistant_message_tool_name: z.union([z.string(), z.undefined()]).optional(),
  assistant_message_tool_kwarg: z.union([z.string(), z.undefined()]).optional(),
  include_return_message_types: z
    .union([
      z.array(MessageType),
      z.null(),
      z.array(z.union([z.array(MessageType), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enable_thinking: z.union([z.string(), z.undefined()]).optional(),
  callback_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type LettaBatchMessages = z.infer<typeof LettaBatchMessages>;
export const LettaBatchMessages = z.object({
  messages: z.array(Message),
});

export type LettaRequest = z.infer<typeof LettaRequest>;
export const LettaRequest = z.object({
  messages: z.array(
    z.union([
      MessageCreate,
      ApprovalCreate,
      z.array(z.union([MessageCreate, ApprovalCreate])),
    ]),
  ),
  max_steps: z.union([z.number(), z.undefined()]).optional(),
  use_assistant_message: z.union([z.boolean(), z.undefined()]).optional(),
  assistant_message_tool_name: z.union([z.string(), z.undefined()]).optional(),
  assistant_message_tool_kwarg: z.union([z.string(), z.undefined()]).optional(),
  include_return_message_types: z
    .union([
      z.array(MessageType),
      z.null(),
      z.array(z.union([z.array(MessageType), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enable_thinking: z.union([z.string(), z.undefined()]).optional(),
});

export type LettaRequestConfig = z.infer<typeof LettaRequestConfig>;
export const LettaRequestConfig = z.object({
  use_assistant_message: z.boolean().optional(),
  assistant_message_tool_name: z.string().optional(),
  assistant_message_tool_kwarg: z.string().optional(),
  include_return_message_types: z
    .union([
      z.array(MessageType),
      z.null(),
      z.array(z.union([z.array(MessageType), z.null()])),
    ])
    .optional(),
});

export type SystemMessage = z.infer<typeof SystemMessage>;
export const SystemMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  content: z.string(),
});

export type LettaUserMessageContentUnion = z.infer<
  typeof LettaUserMessageContentUnion
>;
export const LettaUserMessageContentUnion = z.union([
  TextContent,
  ImageContent,
]);

export type UserMessage = z.infer<typeof UserMessage>;
export const UserMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  content: z.union([
    z.array(LettaUserMessageContentUnion),
    z.string(),
    z.array(z.union([z.array(LettaUserMessageContentUnion), z.string()])),
  ]),
});

export type ReasoningMessage = z.infer<typeof ReasoningMessage>;
export const ReasoningMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  source: z
    .union([
      z.literal('reasoner_model'),
      z.literal('non_reasoner_model'),
      z.undefined(),
    ])
    .optional(),
  reasoning: z.string(),
  signature: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ToolCallMessage = z.infer<typeof ToolCallMessage>;
export const ToolCallMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_call: z.union([
    ToolCall,
    ToolCallDelta,
    z.array(z.union([ToolCall, ToolCallDelta])),
  ]),
});

export type ToolReturnMessage = z.infer<typeof ToolReturnMessage>;
export const ToolReturnMessage = z.object({
  id: z.string(),
  date: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
  otid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sender_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_err: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  seq_id: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_return: z.string(),
  status: z.union([z.literal('success'), z.literal('error')]),
  tool_call_id: z.string(),
  stdout: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  stderr: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type LettaMessageUnion = z.infer<typeof LettaMessageUnion>;
export const LettaMessageUnion = z.union([
  SystemMessage,
  UserMessage,
  ReasoningMessage,
  HiddenReasoningMessage,
  ToolCallMessage,
  ToolReturnMessage,
  AssistantMessage,
  ApprovalRequestMessage,
  ApprovalResponseMessage,
]);

export type LettaStopReason = z.infer<typeof LettaStopReason>;
export const LettaStopReason = z.object({
  message_type: z.union([z.string(), z.undefined()]).optional(),
  stop_reason: StopReasonType,
});

export type LettaUsageStatistics = z.infer<typeof LettaUsageStatistics>;
export const LettaUsageStatistics = z.object({
  message_type: z.string().optional(),
  completion_tokens: z.number().optional(),
  prompt_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
  step_count: z.number().optional(),
  steps_messages: z
    .union([
      z.array(z.array(Message)),
      z.null(),
      z.array(z.union([z.array(z.array(Message)), z.null()])),
    ])
    .optional(),
  run_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
});

export type LettaResponse = z.infer<typeof LettaResponse>;
export const LettaResponse = z.object({
  messages: z.array(LettaMessageUnion),
  stop_reason: LettaStopReason,
  usage: LettaUsageStatistics,
});

export type LettaStreamingRequest = z.infer<typeof LettaStreamingRequest>;
export const LettaStreamingRequest = z.object({
  messages: z.array(
    z.union([
      MessageCreate,
      ApprovalCreate,
      z.array(z.union([MessageCreate, ApprovalCreate])),
    ]),
  ),
  max_steps: z.union([z.number(), z.undefined()]).optional(),
  use_assistant_message: z.union([z.boolean(), z.undefined()]).optional(),
  assistant_message_tool_name: z.union([z.string(), z.undefined()]).optional(),
  assistant_message_tool_kwarg: z.union([z.string(), z.undefined()]).optional(),
  include_return_message_types: z
    .union([
      z.array(MessageType),
      z.null(),
      z.array(z.union([z.array(MessageType), z.null()])),
      z.undefined(),
    ])
    .optional(),
  enable_thinking: z.union([z.string(), z.undefined()]).optional(),
  stream_tokens: z.union([z.boolean(), z.undefined()]).optional(),
  include_pings: z.union([z.boolean(), z.undefined()]).optional(),
  background: z.union([z.boolean(), z.undefined()]).optional(),
});

export type ListDeploymentEntitiesResponse = z.infer<
  typeof ListDeploymentEntitiesResponse
>;
export const ListDeploymentEntitiesResponse = z.object({
  entities: z.union([z.array(DeploymentEntity), z.undefined()]).optional(),
  total_count: z.number(),
  deployment_id: z.string(),
  message: z.string(),
});

export type LocalSandboxConfig = z.infer<typeof LocalSandboxConfig>;
export const LocalSandboxConfig = z.object({
  sandbox_dir: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  use_venv: z.boolean().optional(),
  venv_name: z.string().optional(),
  pip_requirements: z.array(PipRequirement).optional(),
});

export type MCPServerType = z.infer<typeof MCPServerType>;
export const MCPServerType = z.union([
  z.literal('sse'),
  z.literal('stdio'),
  z.literal('streamable_http'),
]);

export type ToolAnnotations = z.infer<typeof ToolAnnotations>;
export const ToolAnnotations = z.intersection(
  z.object({
    title: z
      .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
      .optional(),
    readOnlyHint: z
      .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
      .optional(),
    destructiveHint: z
      .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
      .optional(),
    idempotentHint: z
      .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
      .optional(),
    openWorldHint: z
      .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
      .optional(),
  }),
  z.object({
    string: z.any().optional(),
  }),
);

export type MCPToolHealth = z.infer<typeof MCPToolHealth>;
export const MCPToolHealth = z.object({
  status: z.string(),
  reasons: z.union([z.array(z.string()), z.undefined()]).optional(),
});

export type MCPTool = z.infer<typeof MCPTool>;
export const MCPTool = z.intersection(
  z.object({
    name: z.string(),
    title: z
      .union([
        z.string(),
        z.null(),
        z.array(z.union([z.string(), z.null()])),
        z.undefined(),
      ])
      .optional(),
    description: z
      .union([
        z.string(),
        z.null(),
        z.array(z.union([z.string(), z.null()])),
        z.undefined(),
      ])
      .optional(),
    inputSchema: z.unknown(),
    outputSchema: z
      .union([
        z.unknown(),
        z.null(),
        z.array(z.union([z.unknown(), z.null()])),
        z.undefined(),
      ])
      .optional(),
    annotations: z
      .union([
        ToolAnnotations,
        z.null(),
        z.array(z.union([ToolAnnotations, z.null()])),
        z.undefined(),
      ])
      .optional(),
    _meta: z
      .union([
        z.unknown(),
        z.null(),
        z.array(z.union([z.unknown(), z.null()])),
        z.undefined(),
      ])
      .optional(),
    health: z
      .union([
        MCPToolHealth,
        z.null(),
        z.array(z.union([MCPToolHealth, z.null()])),
        z.undefined(),
      ])
      .optional(),
  }),
  z.object({
    string: z.any(),
  }),
);

export type MCPToolExecuteRequest = z.infer<typeof MCPToolExecuteRequest>;
export const MCPToolExecuteRequest = z.object({
  args: z.unknown().optional(),
});

export type MessageSearchRequest = z.infer<typeof MessageSearchRequest>;
export const MessageSearchRequest = z.object({
  query: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  search_mode: z
    .union([z.literal('vector'), z.literal('fts'), z.literal('hybrid')])
    .optional(),
  roles: z
    .union([
      z.array(MessageRole),
      z.null(),
      z.array(z.union([z.array(MessageRole), z.null()])),
    ])
    .optional(),
  project_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  template_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  limit: z.number().optional(),
  start_date: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  end_date: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
});

export type MessageSearchResult = z.infer<typeof MessageSearchResult>;
export const MessageSearchResult = z.object({
  embedded_text: z.string(),
  message: Message,
  fts_rank: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  vector_rank: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  rrf_score: z.number(),
});

export type ModalSandboxConfig = z.infer<typeof ModalSandboxConfig>;
export const ModalSandboxConfig = z.object({
  timeout: z.number().optional(),
  pip_requirements: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  npm_requirements: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  language: z.union([z.literal('python'), z.literal('typescript')]).optional(),
});

export type ModifyFeedbackRequest = z.infer<typeof ModifyFeedbackRequest>;
export const ModifyFeedbackRequest = z.object({
  feedback: z
    .union([FeedbackType, z.null(), z.array(z.union([FeedbackType, z.null()]))])
    .optional(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
});

export type Organization = z.infer<typeof Organization>;
export const Organization = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  created_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  privileged_tools: z.boolean().optional(),
});

export type OrganizationCreate = z.infer<typeof OrganizationCreate>;
export const OrganizationCreate = z.object({
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  privileged_tools: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
});

export type SourceStats = z.infer<typeof SourceStats>;
export const SourceStats = z.object({
  source_id: z.string(),
  source_name: z.string(),
  file_count: z.union([z.number(), z.undefined()]).optional(),
  total_size: z.union([z.number(), z.undefined()]).optional(),
  files: z.union([z.array(FileStats), z.undefined()]).optional(),
});

export type OrganizationSourcesStats = z.infer<typeof OrganizationSourcesStats>;
export const OrganizationSourcesStats = z.object({
  total_sources: z.number().optional(),
  total_files: z.number().optional(),
  total_size: z.number().optional(),
  sources: z.array(SourceStats).optional(),
});

export type OrganizationUpdate = z.infer<typeof OrganizationUpdate>;
export const OrganizationUpdate = z.object({
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  privileged_tools: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
});

export type PaginatedAgentFiles = z.infer<typeof PaginatedAgentFiles>;
export const PaginatedAgentFiles = z.object({
  files: z.array(AgentFileAttachment),
  next_cursor: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  has_more: z.boolean(),
});

export type Passage = z.infer<typeof Passage>;
export const Passage = z.object({
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z.union([z.string(), z.undefined()]).optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_deleted: z.union([z.boolean(), z.undefined()]).optional(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  archive_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  source_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  file_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  text: z.string(),
  embedding: z.union([
    z.array(z.number()),
    z.null(),
    z.array(z.union([z.array(z.number()), z.null()])),
  ]),
  embedding_config: z.union([
    EmbeddingConfig,
    z.null(),
    z.array(z.union([EmbeddingConfig, z.null()])),
  ]),
});

export type ProviderType = z.infer<typeof ProviderType>;
export const ProviderType = z.union([
  z.literal('anthropic'),
  z.literal('azure'),
  z.literal('bedrock'),
  z.literal('cerebras'),
  z.literal('deepseek'),
  z.literal('google_ai'),
  z.literal('google_vertex'),
  z.literal('groq'),
  z.literal('hugging-face'),
  z.literal('letta'),
  z.literal('lmstudio_openai'),
  z.literal('mistral'),
  z.literal('ollama'),
  z.literal('openai'),
  z.literal('together'),
  z.literal('vllm'),
  z.literal('xai'),
]);

export type Provider = z.infer<typeof Provider>;
export const Provider = z.object({
  id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z.string(),
  provider_type: ProviderType,
  provider_category: ProviderCategory,
  api_key: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  access_key: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  region: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  api_version: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ProviderCheck = z.infer<typeof ProviderCheck>;
export const ProviderCheck = z.object({
  provider_type: ProviderType,
  api_key: z.string(),
  access_key: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  region: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  api_version: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ProviderCreate = z.infer<typeof ProviderCreate>;
export const ProviderCreate = z.object({
  name: z.string(),
  provider_type: ProviderType,
  api_key: z.string(),
  access_key: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  region: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  api_version: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ProviderTrace = z.infer<typeof ProviderTrace>;
export const ProviderTrace = z.object({
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z.union([z.string(), z.undefined()]).optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  request_json: z.unknown(),
  response_json: z.unknown(),
  step_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ProviderUpdate = z.infer<typeof ProviderUpdate>;
export const ProviderUpdate = z.object({
  api_key: z.string(),
  access_key: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  region: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  api_version: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type RetrieveStreamRequest = z.infer<typeof RetrieveStreamRequest>;
export const RetrieveStreamRequest = z.object({
  starting_after: z.number().optional(),
  include_pings: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  poll_interval: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  batch_size: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
});

export type RunStatus = z.infer<typeof RunStatus>;
export const RunStatus = z.union([
  z.literal('created'),
  z.literal('running'),
  z.literal('completed'),
  z.literal('failed'),
  z.literal('cancelled'),
]);

export type Run = z.infer<typeof Run>;
export const Run = z.object({
  id: z.union([z.string(), z.undefined()]).optional(),
  status: z.union([RunStatus, z.undefined()]).optional(),
  created_at: z.union([z.string(), z.undefined()]).optional(),
  completed_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_id: z.string(),
  background: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  request_config: z
    .union([
      LettaRequestConfig,
      z.null(),
      z.array(z.union([LettaRequestConfig, z.null()])),
      z.undefined(),
    ])
    .optional(),
  stop_reason: z
    .union([
      StopReasonType,
      z.null(),
      z.array(z.union([StopReasonType, z.null()])),
      z.undefined(),
    ])
    .optional(),
  callback_url: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  callback_sent_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  callback_status_code: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  callback_error: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  ttft_ns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  total_duration_ns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type SSEServerConfig = z.infer<typeof SSEServerConfig>;
export const SSEServerConfig = z.object({
  server_name: z.string(),
  type: z.union([MCPServerType, z.undefined()]).optional(),
  server_url: z.string(),
  auth_header: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  auth_token: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  custom_headers: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type SandboxType = z.infer<typeof SandboxType>;
export const SandboxType = z.union([
  z.literal('e2b'),
  z.literal('modal'),
  z.literal('local'),
]);

export type SandboxConfig = z.infer<typeof SandboxConfig>;
export const SandboxConfig = z.object({
  created_by_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  last_updated_by_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  created_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  updated_at: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  id: z.string().optional(),
  type: SandboxType.optional(),
  organization_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  config: z.unknown().optional(),
});

export type SandboxConfigCreate = z.infer<typeof SandboxConfigCreate>;
export const SandboxConfigCreate = z.object({
  config: z.union([
    LocalSandboxConfig,
    E2BSandboxConfig,
    ModalSandboxConfig,
    z.array(
      z.union([LocalSandboxConfig, E2BSandboxConfig, ModalSandboxConfig]),
    ),
  ]),
});

export type SandboxConfigUpdate = z.infer<typeof SandboxConfigUpdate>;
export const SandboxConfigUpdate = z.object({
  config: z
    .union([
      LocalSandboxConfig,
      E2BSandboxConfig,
      ModalSandboxConfig,
      z.array(
        z.union([LocalSandboxConfig, E2BSandboxConfig, ModalSandboxConfig]),
      ),
    ])
    .optional(),
});

export type SandboxEnvironmentVariable = z.infer<
  typeof SandboxEnvironmentVariable
>;
export const SandboxEnvironmentVariable = z.object({
  created_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  last_updated_by_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  id: z.union([z.string(), z.undefined()]).optional(),
  key: z.string(),
  value: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  sandbox_config_id: z.string(),
});

export type SandboxEnvironmentVariableCreate = z.infer<
  typeof SandboxEnvironmentVariableCreate
>;
export const SandboxEnvironmentVariableCreate = z.object({
  key: z.string(),
  value: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type SandboxEnvironmentVariableUpdate = z.infer<
  typeof SandboxEnvironmentVariableUpdate
>;
export const SandboxEnvironmentVariableUpdate = z.object({
  key: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  value: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
});

export type SourceCreate = z.infer<typeof SourceCreate>;
export const SourceCreate = z.object({
  name: z.string(),
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  instructions: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  metadata: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_chunk_size: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  embedding_config: z
    .union([
      EmbeddingConfig,
      z.null(),
      z.array(z.union([EmbeddingConfig, z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type SourceUpdate = z.infer<typeof SourceUpdate>;
export const SourceUpdate = z.object({
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  instructions: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  metadata: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  embedding_config: z
    .union([
      EmbeddingConfig,
      z.null(),
      z.array(z.union([EmbeddingConfig, z.null()])),
    ])
    .optional(),
});

export type StdioServerConfig = z.infer<typeof StdioServerConfig>;
export const StdioServerConfig = z.object({
  server_name: z.string(),
  type: z.union([MCPServerType, z.undefined()]).optional(),
  command: z.string(),
  args: z.array(z.string()),
  env: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type StepStatus = z.infer<typeof StepStatus>;
export const StepStatus = z.union([
  z.literal('pending'),
  z.literal('success'),
  z.literal('failed'),
  z.literal('cancelled'),
]);

export type Step = z.infer<typeof Step>;
export const Step = z.object({
  id: z.string(),
  origin: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  provider_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  provider_name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  provider_category: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  model: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  model_endpoint: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  context_window_limit: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  completion_tokens: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  prompt_tokens: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  total_tokens: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  completion_tokens_details: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  stop_reason: z
    .union([
      StopReasonType,
      z.null(),
      z.array(z.union([StopReasonType, z.null()])),
      z.undefined(),
    ])
    .optional(),
  tags: z.union([z.array(z.string()), z.undefined()]).optional(),
  tid: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  trace_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  messages: z.union([z.array(Message), z.undefined()]).optional(),
  feedback: z
    .union([
      z.literal('positive'),
      z.literal('negative'),
      z.null(),
      z.array(
        z.union([z.literal('positive'), z.literal('negative'), z.null()]),
      ),
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  error_type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  error_data: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  status: z
    .union([
      StepStatus,
      z.null(),
      z.array(z.union([StepStatus, z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type StepMetrics = z.infer<typeof StepMetrics>;
export const StepMetrics = z.object({
  id: z.string(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  provider_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  run_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  agent_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_start_ns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  llm_request_start_ns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  llm_request_ns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tool_execution_ns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  step_ns: z
    .union([
      z.number(),
      z.null(),
      z.array(z.union([z.number(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  base_template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  template_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  project_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type StreamableHTTPServerConfig = z.infer<
  typeof StreamableHTTPServerConfig
>;
export const StreamableHTTPServerConfig = z.object({
  server_name: z.string(),
  type: z.union([MCPServerType, z.undefined()]).optional(),
  server_url: z.string(),
  auth_header: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  auth_token: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  custom_headers: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ToolCreate = z.infer<typeof ToolCreate>;
export const ToolCreate = z.object({
  description: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
      z.undefined(),
    ])
    .optional(),
  source_code: z.string(),
  source_type: z.union([z.string(), z.undefined()]).optional(),
  json_schema: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  args_json_schema: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  return_char_limit: z.union([z.number(), z.undefined()]).optional(),
  pip_requirements: z
    .union([
      z.array(PipRequirement),
      z.null(),
      z.array(z.union([z.array(PipRequirement), z.null()])),
      z.undefined(),
    ])
    .optional(),
  npm_requirements: z
    .union([
      z.array(NpmRequirement),
      z.null(),
      z.array(z.union([z.array(NpmRequirement), z.null()])),
      z.undefined(),
    ])
    .optional(),
  default_requires_approval: z
    .union([
      z.boolean(),
      z.null(),
      z.array(z.union([z.boolean(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ToolRunFromSource = z.infer<typeof ToolRunFromSource>;
export const ToolRunFromSource = z.object({
  source_code: z.string(),
  args: z.unknown(),
  env_vars: z.union([z.unknown(), z.undefined()]).optional(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  source_type: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  args_json_schema: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  json_schema: z
    .union([
      z.unknown(),
      z.null(),
      z.array(z.union([z.unknown(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  pip_requirements: z
    .union([
      z.array(PipRequirement),
      z.null(),
      z.array(z.union([z.array(PipRequirement), z.null()])),
      z.undefined(),
    ])
    .optional(),
  npm_requirements: z
    .union([
      z.array(NpmRequirement),
      z.null(),
      z.array(z.union([z.array(NpmRequirement), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type ToolUpdate = z.infer<typeof ToolUpdate>;
export const ToolUpdate = z.object({
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  source_code: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  source_type: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  json_schema: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  args_json_schema: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  return_char_limit: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  pip_requirements: z
    .union([
      z.array(PipRequirement),
      z.null(),
      z.array(z.union([z.array(PipRequirement), z.null()])),
    ])
    .optional(),
  npm_requirements: z
    .union([
      z.array(NpmRequirement),
      z.null(),
      z.array(z.union([z.array(NpmRequirement), z.null()])),
    ])
    .optional(),
  metadata_: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  default_requires_approval: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
});

export type UpdateAgent = z.infer<typeof UpdateAgent>;
export const UpdateAgent = z.object({
  name: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  tool_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  source_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  block_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  tags: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  system: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  tool_rules: z
    .union([
      z.array(
        z.union([
          ChildToolRule,
          InitToolRule,
          TerminalToolRule,
          ConditionalToolRule,
          ContinueToolRule,
          RequiredBeforeExitToolRule,
          MaxCountPerStepToolRule,
          ParentToolRule,
          RequiresApprovalToolRule,
        ]),
      ),
      z.null(),
      z.array(
        z.union([
          z.array(
            z.union([
              ChildToolRule,
              InitToolRule,
              TerminalToolRule,
              ConditionalToolRule,
              ContinueToolRule,
              RequiredBeforeExitToolRule,
              MaxCountPerStepToolRule,
              ParentToolRule,
              RequiresApprovalToolRule,
            ]),
          ),
          z.null(),
        ]),
      ),
    ])
    .optional(),
  llm_config: z
    .union([LLMConfig, z.null(), z.array(z.union([LLMConfig, z.null()]))])
    .optional(),
  embedding_config: z
    .union([
      EmbeddingConfig,
      z.null(),
      z.array(z.union([EmbeddingConfig, z.null()])),
    ])
    .optional(),
  message_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  description: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  metadata: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  tool_exec_environment_variables: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  secrets: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
  project_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  template_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  base_template_id: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  identity_ids: z
    .union([
      z.array(z.string()),
      z.null(),
      z.array(z.union([z.array(z.string()), z.null()])),
    ])
    .optional(),
  message_buffer_autoclear: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  model: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  embedding: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  reasoning: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  enable_sleeptime: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
  response_format: z
    .union([
      TextResponseFormat,
      JsonSchemaResponseFormat,
      JsonObjectResponseFormat,
      z.null(),
      z.array(
        z.union([
          TextResponseFormat,
          JsonSchemaResponseFormat,
          JsonObjectResponseFormat,
          z.null(),
        ]),
      ),
    ])
    .optional(),
  last_run_completion: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  last_run_duration_ms: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  timezone: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  max_files_open: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  per_file_view_window_char_limit: z
    .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
    .optional(),
  hidden: z
    .union([z.boolean(), z.null(), z.array(z.union([z.boolean(), z.null()]))])
    .optional(),
});

export type UpdateAssistantMessage = z.infer<typeof UpdateAssistantMessage>;
export const UpdateAssistantMessage = z.object({
  message_type: z.union([z.string(), z.undefined()]).optional(),
  content: z.union([
    z.array(TextContent),
    z.string(),
    z.array(z.union([z.array(TextContent), z.string()])),
  ]),
});

export type UpdateReasoningMessage = z.infer<typeof UpdateReasoningMessage>;
export const UpdateReasoningMessage = z.object({
  reasoning: z.string(),
  message_type: z.union([z.string(), z.undefined()]).optional(),
});

export type UpdateSSEMCPServer = z.infer<typeof UpdateSSEMCPServer>;
export const UpdateSSEMCPServer = z.object({
  server_url: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  token: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  custom_headers: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
});

export type UpdateStdioMCPServer = z.infer<typeof UpdateStdioMCPServer>;
export const UpdateStdioMCPServer = z.object({
  stdio_config: z
    .union([
      StdioServerConfig,
      z.null(),
      z.array(z.union([StdioServerConfig, z.null()])),
    ])
    .optional(),
});

export type UpdateStreamableHTTPMCPServer = z.infer<
  typeof UpdateStreamableHTTPMCPServer
>;
export const UpdateStreamableHTTPMCPServer = z.object({
  server_url: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  auth_header: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  auth_token: z
    .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
    .optional(),
  custom_headers: z
    .union([z.unknown(), z.null(), z.array(z.union([z.unknown(), z.null()]))])
    .optional(),
});

export type UpdateSystemMessage = z.infer<typeof UpdateSystemMessage>;
export const UpdateSystemMessage = z.object({
  message_type: z.union([z.string(), z.undefined()]).optional(),
  content: z.string(),
});

export type UpdateUserMessage = z.infer<typeof UpdateUserMessage>;
export const UpdateUserMessage = z.object({
  message_type: z.union([z.string(), z.undefined()]).optional(),
  content: z.union([
    z.array(LettaUserMessageContentUnion),
    z.string(),
    z.array(z.union([z.array(LettaUserMessageContentUnion), z.string()])),
  ]),
});

export type UsageStatisticsPromptTokenDetails = z.infer<
  typeof UsageStatisticsPromptTokenDetails
>;
export const UsageStatisticsPromptTokenDetails = z.object({
  cached_tokens: z.number().optional(),
});

export type UsageStatisticsCompletionTokenDetails = z.infer<
  typeof UsageStatisticsCompletionTokenDetails
>;
export const UsageStatisticsCompletionTokenDetails = z.object({
  reasoning_tokens: z.number().optional(),
});

export type UsageStatistics = z.infer<typeof UsageStatistics>;
export const UsageStatistics = z.object({
  completion_tokens: z.number().optional(),
  prompt_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
  prompt_tokens_details: z
    .union([
      UsageStatisticsPromptTokenDetails,
      z.null(),
      z.array(z.union([UsageStatisticsPromptTokenDetails, z.null()])),
    ])
    .optional(),
  completion_tokens_details: z
    .union([
      UsageStatisticsCompletionTokenDetails,
      z.null(),
      z.array(z.union([UsageStatisticsCompletionTokenDetails, z.null()])),
    ])
    .optional(),
});

export type User = z.infer<typeof User>;
export const User = z.object({
  id: z.union([z.string(), z.undefined()]).optional(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  name: z.string(),
  created_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  updated_at: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  is_deleted: z.union([z.boolean(), z.undefined()]).optional(),
});

export type UserCreate = z.infer<typeof UserCreate>;
export const UserCreate = z.object({
  name: z.string(),
  organization_id: z.string(),
});

export type UserUpdate = z.infer<typeof UserUpdate>;
export const UserUpdate = z.object({
  id: z.string(),
  name: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
  organization_id: z
    .union([
      z.string(),
      z.null(),
      z.array(z.union([z.string(), z.null()])),
      z.undefined(),
    ])
    .optional(),
});

export type LettaPing = z.infer<typeof LettaPing>;
export const LettaPing = z.object({
  message_type: z.string(),
});

export type post_Create_archive = typeof post_Create_archive;
export const post_Create_archive = {
  method: z.literal('POST'),
  path: z.literal('/v1/archives/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ArchiveCreateRequest,
  }),
  response: Archive,
};

export type get_List_archives = typeof get_List_archives;
export const get_List_archives = {
  method: z.literal('GET'),
  path: z.literal('/v1/archives/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      agent_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Archive),
};

export type patch_Modify_archive = typeof patch_Modify_archive;
export const patch_Modify_archive = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/archives/{archive_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      archive_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ArchiveUpdateRequest,
  }),
  response: Archive,
};

export type delete_Delete_tool = typeof delete_Delete_tool;
export const delete_Delete_tool = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/tools/{tool_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      tool_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Retrieve_tool = typeof get_Retrieve_tool;
export const get_Retrieve_tool = {
  method: z.literal('GET'),
  path: z.literal('/v1/tools/{tool_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      tool_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Tool,
};

export type patch_Modify_tool = typeof patch_Modify_tool;
export const patch_Modify_tool = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/tools/{tool_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      tool_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ToolUpdate,
  }),
  response: Tool,
};

export type get_Count_tools = typeof get_Count_tools;
export const get_Count_tools = {
  method: z.literal('GET'),
  path: z.literal('/v1/tools/count'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      names: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      tool_ids: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      search: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      tool_types: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      exclude_tool_types: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      return_only_letta_tools: z
        .union([
          z.boolean(),
          z.null(),
          z.array(z.union([z.boolean(), z.null()])),
        ])
        .optional(),
      exclude_letta_tools: z
        .union([
          z.boolean(),
          z.null(),
          z.array(z.union([z.boolean(), z.null()])),
        ])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.number(),
};

export type get_List_tools = typeof get_List_tools;
export const get_List_tools = {
  method: z.literal('GET'),
  path: z.literal('/v1/tools/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      names: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      tool_ids: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      search: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      tool_types: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      exclude_tool_types: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      return_only_letta_tools: z
        .union([
          z.boolean(),
          z.null(),
          z.array(z.union([z.boolean(), z.null()])),
        ])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Tool),
};

export type post_Create_tool = typeof post_Create_tool;
export const post_Create_tool = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ToolCreate,
  }),
  response: Tool,
};

export type put_Upsert_tool = typeof put_Upsert_tool;
export const put_Upsert_tool = {
  method: z.literal('PUT'),
  path: z.literal('/v1/tools/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ToolCreate,
  }),
  response: Tool,
};

export type post_Add_base_tools = typeof post_Add_base_tools;
export const post_Add_base_tools = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/add-base-tools'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Tool),
};

export type post_Run_tool_from_source = typeof post_Run_tool_from_source;
export const post_Run_tool_from_source = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/run'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ToolRunFromSource,
  }),
  response: ToolReturnMessage,
};

export type get_List_composio_apps = typeof get_List_composio_apps;
export const get_List_composio_apps = {
  method: z.literal('GET'),
  path: z.literal('/v1/tools/composio/apps'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(AppModel),
};

export type get_List_composio_actions_by_app =
  typeof get_List_composio_actions_by_app;
export const get_List_composio_actions_by_app = {
  method: z.literal('GET'),
  path: z.literal('/v1/tools/composio/apps/{composio_app_name}/actions'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      composio_app_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(ActionModel),
};

export type post_Add_composio_tool = typeof post_Add_composio_tool;
export const post_Add_composio_tool = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/composio/{composio_action_name}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      composio_action_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Tool,
};

export type get_List_mcp_servers = typeof get_List_mcp_servers;
export const get_List_mcp_servers = {
  method: z.literal('GET'),
  path: z.literal('/v1/tools/mcp/servers'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type put_Add_mcp_server = typeof put_Add_mcp_server;
export const put_Add_mcp_server = {
  method: z.literal('PUT'),
  path: z.literal('/v1/tools/mcp/servers'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.union([
      StdioServerConfig,
      SSEServerConfig,
      StreamableHTTPServerConfig,
      z.array(
        z.union([
          StdioServerConfig,
          SSEServerConfig,
          StreamableHTTPServerConfig,
        ]),
      ),
    ]),
  }),
  response: z.array(
    z.union([
      StdioServerConfig,
      SSEServerConfig,
      StreamableHTTPServerConfig,
      z.array(
        z.union([
          StdioServerConfig,
          SSEServerConfig,
          StreamableHTTPServerConfig,
        ]),
      ),
    ]),
  ),
};

export type get_List_mcp_tools_by_server = typeof get_List_mcp_tools_by_server;
export const get_List_mcp_tools_by_server = {
  method: z.literal('GET'),
  path: z.literal('/v1/tools/mcp/servers/{mcp_server_name}/tools'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      mcp_server_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(MCPTool),
};

export type post_Resync_mcp_server_tools = typeof post_Resync_mcp_server_tools;
export const post_Resync_mcp_server_tools = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/mcp/servers/{mcp_server_name}/resync'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      agent_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    path: z.object({
      mcp_server_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Add_mcp_tool = typeof post_Add_mcp_tool;
export const post_Add_mcp_tool = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/mcp/servers/{mcp_server_name}/{mcp_tool_name}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      mcp_server_name: z.string(),
      mcp_tool_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Tool,
};

export type patch_Update_mcp_server = typeof patch_Update_mcp_server;
export const patch_Update_mcp_server = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/tools/mcp/servers/{mcp_server_name}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      mcp_server_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.union([
      UpdateStdioMCPServer,
      UpdateSSEMCPServer,
      UpdateStreamableHTTPMCPServer,
      z.array(
        z.union([
          UpdateStdioMCPServer,
          UpdateSSEMCPServer,
          UpdateStreamableHTTPMCPServer,
        ]),
      ),
    ]),
  }),
  response: z.union([
    StdioServerConfig,
    SSEServerConfig,
    StreamableHTTPServerConfig,
    z.array(
      z.union([StdioServerConfig, SSEServerConfig, StreamableHTTPServerConfig]),
    ),
  ]),
};

export type delete_Delete_mcp_server = typeof delete_Delete_mcp_server;
export const delete_Delete_mcp_server = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/tools/mcp/servers/{mcp_server_name}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      mcp_server_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(
    z.union([
      StdioServerConfig,
      SSEServerConfig,
      StreamableHTTPServerConfig,
      z.array(
        z.union([
          StdioServerConfig,
          SSEServerConfig,
          StreamableHTTPServerConfig,
        ]),
      ),
    ]),
  ),
};

export type post_Test_mcp_server = typeof post_Test_mcp_server;
export const post_Test_mcp_server = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/mcp/servers/test'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.union([
      StdioServerConfig,
      SSEServerConfig,
      StreamableHTTPServerConfig,
      z.array(
        z.union([
          StdioServerConfig,
          SSEServerConfig,
          StreamableHTTPServerConfig,
        ]),
      ),
    ]),
  }),
  response: z.unknown(),
};

export type post_Connect_mcp_server = typeof post_Connect_mcp_server;
export const post_Connect_mcp_server = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/mcp/servers/connect'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.union([
      StdioServerConfig,
      SSEServerConfig,
      StreamableHTTPServerConfig,
      z.array(
        z.union([
          StdioServerConfig,
          SSEServerConfig,
          StreamableHTTPServerConfig,
        ]),
      ),
    ]),
  }),
  response: z.unknown(),
};

export type post_Generate_json_schema = typeof post_Generate_json_schema;
export const post_Generate_json_schema = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/generate-schema'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: CodeInput,
  }),
  response: z.unknown(),
};

export type post_Execute_mcp_tool = typeof post_Execute_mcp_tool;
export const post_Execute_mcp_tool = {
  method: z.literal('POST'),
  path: z.literal(
    '/v1/tools/mcp/servers/{mcp_server_name}/tools/{tool_name}/execute',
  ),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      mcp_server_name: z.string(),
      tool_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: MCPToolExecuteRequest,
  }),
  response: z.unknown(),
};

export type get_Mcp_oauth_callback = typeof get_Mcp_oauth_callback;
export const get_Mcp_oauth_callback = {
  method: z.literal('GET'),
  path: z.literal('/v1/tools/mcp/oauth/callback/{session_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      code: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      state: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      error: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      error_description: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    path: z.object({
      session_id: z.string(),
    }),
  }),
  response: z.unknown(),
};

export type post_Generate_tool = typeof post_Generate_tool;
export const post_Generate_tool = {
  method: z.literal('POST'),
  path: z.literal('/v1/tools/generate-tool'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: GenerateToolInput,
  }),
  response: GenerateToolOutput,
};

export type get_Count_folders = typeof get_Count_folders;
export const get_Count_folders = {
  method: z.literal('GET'),
  path: z.literal('/v1/folders/count'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.number(),
};

export type get_Retrieve_folder = typeof get_Retrieve_folder;
export const get_Retrieve_folder = {
  method: z.literal('GET'),
  path: z.literal('/v1/folders/{folder_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Folder,
};

export type patch_Modify_folder = typeof patch_Modify_folder;
export const patch_Modify_folder = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/folders/{folder_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: SourceUpdate,
  }),
  response: Folder,
};

export type delete_Delete_folder = typeof delete_Delete_folder;
export const delete_Delete_folder = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/folders/{folder_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Retrieve_metadata = typeof get_Retrieve_metadata;
export const get_Retrieve_metadata = {
  method: z.literal('GET'),
  path: z.literal('/v1/folders/metadata'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      include_detailed_per_source_metadata: z.boolean().optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: OrganizationSourcesStats,
};

export type get_List_folders = typeof get_List_folders;
export const get_List_folders = {
  method: z.literal('GET'),
  path: z.literal('/v1/folders/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Folder),
};

export type post_Create_folder = typeof post_Create_folder;
export const post_Create_folder = {
  method: z.literal('POST'),
  path: z.literal('/v1/folders/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: SourceCreate,
  }),
  response: Folder,
};

export type post_Upload_file_to_folder = typeof post_Upload_file_to_folder;
export const post_Upload_file_to_folder = {
  method: z.literal('POST'),
  path: z.literal('/v1/folders/{folder_id}/upload'),
  requestFormat: z.literal('form-data'),
  parameters: z.object({
    query: z.object({
      duplicate_handling: z
        .union([
          z.literal('skip'),
          z.literal('error'),
          z.literal('suffix'),
          z.literal('replace'),
        ])
        .optional(),
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    path: z.object({
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: Body_upload_file_to_folder,
  }),
  response: FileMetadata,
};

export type get_List_agents_for_folder = typeof get_List_agents_for_folder;
export const get_List_agents_for_folder = {
  method: z.literal('GET'),
  path: z.literal('/v1/folders/{folder_id}/agents'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
    }),
    path: z.object({
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(z.string()),
};

export type get_List_folder_passages = typeof get_List_folder_passages;
export const get_List_folder_passages = {
  method: z.literal('GET'),
  path: z.literal('/v1/folders/{folder_id}/passages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
    }),
    path: z.object({
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Passage),
};

export type get_List_folder_files = typeof get_List_folder_files;
export const get_List_folder_files = {
  method: z.literal('GET'),
  path: z.literal('/v1/folders/{folder_id}/files'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      include_content: z.boolean().optional(),
    }),
    path: z.object({
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(FileMetadata),
};

export type delete_Delete_file_from_folder =
  typeof delete_Delete_file_from_folder;
export const delete_Delete_file_from_folder = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/folders/{folder_id}/{file_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      folder_id: z.string(),
      file_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_List_agents = typeof get_List_agents;
export const get_List_agents = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      tags: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      match_all_tags: z.boolean().optional(),
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      query_text: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      project_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      template_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      base_template_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      identity_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      identifier_keys: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      include_relationships: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z
        .union([z.literal('created_at'), z.literal('last_run_completion')])
        .optional(),
      ascending: z.boolean().optional(),
      sort_by: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(AgentState),
};

export type post_Create_agent = typeof post_Create_agent;
export const post_Create_agent = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      'X-Project': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: CreateAgentRequest,
  }),
  response: AgentState,
};

export type get_Count_agents = typeof get_Count_agents;
export const get_Count_agents = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/count'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.number(),
};

export type get_Export_agent = typeof get_Export_agent;
export const get_Export_agent = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/export'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      max_steps: z.number().optional(),
      use_legacy_format: z.boolean().optional(),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: Body_export_agent,
  }),
  response: z.string(),
};

export type post_Import_agent = typeof post_Import_agent;
export const post_Import_agent = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/import'),
  requestFormat: z.literal('form-data'),
  parameters: z.object({
    header: z.object({
      'x-override-embedding-model': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: Body_import_agent,
  }),
  response: ImportedAgentsResponse,
};

export type get_Retrieve_agent_context_window =
  typeof get_Retrieve_agent_context_window;
export const get_Retrieve_agent_context_window = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/context'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: ContextWindowOverview,
};

export type patch_Modify_agent = typeof patch_Modify_agent;
export const patch_Modify_agent = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: UpdateAgent,
  }),
  response: AgentState,
};

export type get_Retrieve_agent = typeof get_Retrieve_agent;
export const get_Retrieve_agent = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      include_relationships: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type delete_Delete_agent = typeof delete_Delete_agent;
export const delete_Delete_agent = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/agents/{agent_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_List_agent_tools = typeof get_List_agent_tools;
export const get_List_agent_tools = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/tools'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Tool),
};

export type patch_Attach_tool = typeof patch_Attach_tool;
export const patch_Attach_tool = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/tools/attach/{tool_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      tool_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type patch_Detach_tool = typeof patch_Detach_tool;
export const patch_Detach_tool = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/tools/detach/{tool_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      tool_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type patch_Modify_approval = typeof patch_Modify_approval;
export const patch_Modify_approval = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/tools/approval/{tool_name}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      requires_approval: z.boolean(),
    }),
    path: z.object({
      agent_id: z.string(),
      tool_name: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type patch_Attach_source_to_agent = typeof patch_Attach_source_to_agent;
export const patch_Attach_source_to_agent = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/sources/attach/{source_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      source_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type patch_Attach_folder_to_agent = typeof patch_Attach_folder_to_agent;
export const patch_Attach_folder_to_agent = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/folders/attach/{folder_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type patch_Detach_source_from_agent =
  typeof patch_Detach_source_from_agent;
export const patch_Detach_source_from_agent = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/sources/detach/{source_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      source_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type patch_Detach_folder_from_agent =
  typeof patch_Detach_folder_from_agent;
export const patch_Detach_folder_from_agent = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/folders/detach/{folder_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      folder_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type patch_Close_all_open_files = typeof patch_Close_all_open_files;
export const patch_Close_all_open_files = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/files/close-all'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(z.string()),
};

export type patch_Open_file = typeof patch_Open_file;
export const patch_Open_file = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/files/{file_id}/open'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      file_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(z.string()),
};

export type patch_Close_file = typeof patch_Close_file;
export const patch_Close_file = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/files/{file_id}/close'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      file_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_List_agent_sources = typeof get_List_agent_sources;
export const get_List_agent_sources = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/sources'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Source),
};

export type get_List_agent_folders = typeof get_List_agent_folders;
export const get_List_agent_folders = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/folders'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Source),
};

export type get_List_agent_files = typeof get_List_agent_files;
export const get_List_agent_files = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/files'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      cursor: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z.number().optional(),
      is_open: z
        .union([
          z.boolean(),
          z.null(),
          z.array(z.union([z.boolean(), z.null()])),
        ])
        .optional(),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: PaginatedAgentFiles,
};

export type get_Retrieve_agent_memory = typeof get_Retrieve_agent_memory;
export const get_Retrieve_agent_memory = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/core-memory'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Memory,
};

export type get_Retrieve_core_memory_block =
  typeof get_Retrieve_core_memory_block;
export const get_Retrieve_core_memory_block = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/core-memory/blocks/{block_label}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      block_label: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Block,
};

export type patch_Modify_core_memory_block =
  typeof patch_Modify_core_memory_block;
export const patch_Modify_core_memory_block = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/core-memory/blocks/{block_label}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      block_label: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: BlockUpdate,
  }),
  response: Block,
};

export type get_List_core_memory_blocks = typeof get_List_core_memory_blocks;
export const get_List_core_memory_blocks = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/core-memory/blocks'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Block),
};

export type patch_Attach_core_memory_block =
  typeof patch_Attach_core_memory_block;
export const patch_Attach_core_memory_block = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/core-memory/blocks/attach/{block_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      block_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type patch_Detach_core_memory_block =
  typeof patch_Detach_core_memory_block;
export const patch_Detach_core_memory_block = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/core-memory/blocks/detach/{block_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      block_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type get_List_passages = typeof get_List_passages;
export const get_List_passages = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/archival-memory'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      search: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      ascending: z
        .union([
          z.boolean(),
          z.null(),
          z.array(z.union([z.boolean(), z.null()])),
        ])
        .optional(),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Passage),
};

export type post_Create_passage = typeof post_Create_passage;
export const post_Create_passage = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/{agent_id}/archival-memory'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: CreateArchivalMemory,
  }),
  response: z.array(Passage),
};

export type get_Search_archival_memory = typeof get_Search_archival_memory;
export const get_Search_archival_memory = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/archival-memory/search'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      query: z.string(),
      tags: z.union([
        z.array(z.string()),
        z.null(),
        z.array(z.union([z.array(z.string()), z.null()])),
        z.undefined(),
      ]),
      tag_match_mode: z.union([
        z.literal('any'),
        z.literal('all'),
        z.undefined(),
      ]),
      top_k: z.union([
        z.number(),
        z.null(),
        z.array(z.union([z.number(), z.null()])),
        z.undefined(),
      ]),
      start_datetime: z.union([
        z.string(),
        z.null(),
        z.array(z.union([z.string(), z.null()])),
        z.undefined(),
      ]),
      end_datetime: z.union([
        z.string(),
        z.null(),
        z.array(z.union([z.string(), z.null()])),
        z.undefined(),
      ]),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: ArchivalMemorySearchResponse,
};

export type delete_Delete_passage = typeof delete_Delete_passage;
export const delete_Delete_passage = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/agents/{agent_id}/archival-memory/{memory_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      memory_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_List_messages = typeof get_List_messages;
export const get_List_messages = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z.number().optional(),
      group_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      use_assistant_message: z.boolean().optional(),
      assistant_message_tool_name: z.string().optional(),
      assistant_message_tool_kwarg: z.string().optional(),
      include_err: z
        .union([
          z.boolean(),
          z.null(),
          z.array(z.union([z.boolean(), z.null()])),
        ])
        .optional(),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(LettaMessageUnion),
};

export type post_Send_message = typeof post_Send_message;
export const post_Send_message = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/{agent_id}/messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: LettaRequest,
  }),
  response: LettaResponse,
};

export type patch_Modify_message = typeof patch_Modify_message;
export const patch_Modify_message = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/messages/{message_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
      message_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.union([
      UpdateSystemMessage,
      UpdateUserMessage,
      UpdateReasoningMessage,
      UpdateAssistantMessage,
      z.array(
        z.union([
          UpdateSystemMessage,
          UpdateUserMessage,
          UpdateReasoningMessage,
          UpdateAssistantMessage,
        ]),
      ),
    ]),
  }),
  response: z.union([
    SystemMessage,
    UserMessage,
    ReasoningMessage,
    HiddenReasoningMessage,
    ToolCallMessage,
    ToolReturnMessage,
    AssistantMessage,
    ApprovalRequestMessage,
    ApprovalResponseMessage,
  ]),
};

export type post_Create_agent_message_stream =
  typeof post_Create_agent_message_stream;
export const post_Create_agent_message_stream = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/{agent_id}/messages/stream'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: LettaStreamingRequest,
  }),
  response: z.unknown(),
};

export type post_Cancel_agent_run = typeof post_Cancel_agent_run;
export const post_Cancel_agent_run = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/{agent_id}/messages/cancel'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: CancelAgentRunRequest,
  }),
  response: z.unknown(),
};

export type post_Search_messages = typeof post_Search_messages;
export const post_Search_messages = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/messages/search'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: MessageSearchRequest,
  }),
  response: z.array(MessageSearchResult),
};

export type post_Create_agent_message_async =
  typeof post_Create_agent_message_async;
export const post_Create_agent_message_async = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/{agent_id}/messages/async'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: LettaAsyncRequest,
  }),
  response: Run,
};

export type patch_Reset_messages = typeof patch_Reset_messages;
export const patch_Reset_messages = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/agents/{agent_id}/reset-messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      add_default_initial_messages: z.boolean().optional(),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: AgentState,
};

export type get_List_agent_groups = typeof get_List_agent_groups;
export const get_List_agent_groups = {
  method: z.literal('GET'),
  path: z.literal('/v1/agents/{agent_id}/groups'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      manager_type: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Group),
};

export type post_Preview_raw_payload = typeof post_Preview_raw_payload;
export const post_Preview_raw_payload = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/{agent_id}/messages/preview-raw-payload'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.union([
      LettaRequest,
      LettaStreamingRequest,
      z.array(z.union([LettaRequest, LettaStreamingRequest])),
    ]),
  }),
  response: z.unknown(),
};

export type post_Summarize_agent_conversation =
  typeof post_Summarize_agent_conversation;
export const post_Summarize_agent_conversation = {
  method: z.literal('POST'),
  path: z.literal('/v1/agents/{agent_id}/summarize'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      max_message_length: z.number(),
    }),
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_List_groups = typeof get_List_groups;
export const get_List_groups = {
  method: z.literal('GET'),
  path: z.literal('/v1/groups/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      manager_type: z
        .union([
          ManagerType,
          z.null(),
          z.array(z.union([ManagerType, z.null()])),
        ])
        .optional(),
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      project_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Group),
};

export type post_Create_group = typeof post_Create_group;
export const post_Create_group = {
  method: z.literal('POST'),
  path: z.literal('/v1/groups/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      'X-Project': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: GroupCreate,
  }),
  response: Group,
};

export type get_Count_groups = typeof get_Count_groups;
export const get_Count_groups = {
  method: z.literal('GET'),
  path: z.literal('/v1/groups/count'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.number(),
};

export type get_Retrieve_group = typeof get_Retrieve_group;
export const get_Retrieve_group = {
  method: z.literal('GET'),
  path: z.literal('/v1/groups/{group_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      group_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Group,
};

export type patch_Modify_group = typeof patch_Modify_group;
export const patch_Modify_group = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/groups/{group_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      group_id: z.string(),
    }),
    header: z.object({
      'X-Project': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: GroupUpdate,
  }),
  response: Group,
};

export type delete_Delete_group = typeof delete_Delete_group;
export const delete_Delete_group = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/groups/{group_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      group_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Send_group_message = typeof post_Send_group_message;
export const post_Send_group_message = {
  method: z.literal('POST'),
  path: z.literal('/v1/groups/{group_id}/messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      group_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: LettaRequest,
  }),
  response: LettaResponse,
};

export type get_List_group_messages = typeof get_List_group_messages;
export const get_List_group_messages = {
  method: z.literal('GET'),
  path: z.literal('/v1/groups/{group_id}/messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      use_assistant_message: z.boolean().optional(),
      assistant_message_tool_name: z.string().optional(),
      assistant_message_tool_kwarg: z.string().optional(),
    }),
    path: z.object({
      group_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(LettaMessageUnion),
};

export type post_Send_group_message_streaming =
  typeof post_Send_group_message_streaming;
export const post_Send_group_message_streaming = {
  method: z.literal('POST'),
  path: z.literal('/v1/groups/{group_id}/messages/stream'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      group_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: LettaStreamingRequest,
  }),
  response: z.unknown(),
};

export type patch_Modify_group_message = typeof patch_Modify_group_message;
export const patch_Modify_group_message = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/groups/{group_id}/messages/{message_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      group_id: z.string(),
      message_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.union([
      UpdateSystemMessage,
      UpdateUserMessage,
      UpdateReasoningMessage,
      UpdateAssistantMessage,
      z.array(
        z.union([
          UpdateSystemMessage,
          UpdateUserMessage,
          UpdateReasoningMessage,
          UpdateAssistantMessage,
        ]),
      ),
    ]),
  }),
  response: z.union([
    SystemMessage,
    UserMessage,
    ReasoningMessage,
    HiddenReasoningMessage,
    ToolCallMessage,
    ToolReturnMessage,
    AssistantMessage,
    ApprovalRequestMessage,
    ApprovalResponseMessage,
  ]),
};

export type patch_Reset_group_messages = typeof patch_Reset_group_messages;
export const patch_Reset_group_messages = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/groups/{group_id}/reset-messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      group_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_List_identities = typeof get_List_identities;
export const get_List_identities = {
  method: z.literal('GET'),
  path: z.literal('/v1/identities/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      project_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      identifier_key: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      identity_type: z
        .union([
          IdentityType,
          z.null(),
          z.array(z.union([IdentityType, z.null()])),
        ])
        .optional(),
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Identity),
};

export type post_Create_identity = typeof post_Create_identity;
export const post_Create_identity = {
  method: z.literal('POST'),
  path: z.literal('/v1/identities/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      'X-Project': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: IdentityCreate,
  }),
  response: Identity,
};

export type put_Upsert_identity = typeof put_Upsert_identity;
export const put_Upsert_identity = {
  method: z.literal('PUT'),
  path: z.literal('/v1/identities/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      'X-Project': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: IdentityUpsert,
  }),
  response: Identity,
};

export type get_Count_identities = typeof get_Count_identities;
export const get_Count_identities = {
  method: z.literal('GET'),
  path: z.literal('/v1/identities/count'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.number(),
};

export type get_Retrieve_identity = typeof get_Retrieve_identity;
export const get_Retrieve_identity = {
  method: z.literal('GET'),
  path: z.literal('/v1/identities/{identity_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      identity_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Identity,
};

export type patch_Update_identity = typeof patch_Update_identity;
export const patch_Update_identity = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/identities/{identity_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      identity_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: IdentityUpdate,
  }),
  response: Identity,
};

export type delete_Delete_identity = typeof delete_Delete_identity;
export const delete_Delete_identity = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/identities/{identity_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      identity_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type put_Upsert_identity_properties =
  typeof put_Upsert_identity_properties;
export const put_Upsert_identity_properties = {
  method: z.literal('PUT'),
  path: z.literal('/v1/identities/{identity_id}/properties'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      identity_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.array(IdentityProperty),
  }),
  response: z.unknown(),
};

export type get_List_agents_for_identity = typeof get_List_agents_for_identity;
export const get_List_agents_for_identity = {
  method: z.literal('GET'),
  path: z.literal('/v1/identities/{identity_id}/agents'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
    }),
    path: z.object({
      identity_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(AgentState),
};

export type get_List_blocks_for_identity = typeof get_List_blocks_for_identity;
export const get_List_blocks_for_identity = {
  method: z.literal('GET'),
  path: z.literal('/v1/identities/{identity_id}/blocks'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
    }),
    path: z.object({
      identity_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Block),
};

export type post_Create_internal_template_group =
  typeof post_Create_internal_template_group;
export const post_Create_internal_template_group = {
  method: z.literal('POST'),
  path: z.literal('/v1/_internal_templates/groups'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: InternalTemplateGroupCreate,
  }),
  response: Group,
};

export type post_Create_internal_template_agent =
  typeof post_Create_internal_template_agent;
export const post_Create_internal_template_agent = {
  method: z.literal('POST'),
  path: z.literal('/v1/_internal_templates/agents'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: InternalTemplateAgentCreate,
  }),
  response: AgentState,
};

export type post_Create_internal_template_block =
  typeof post_Create_internal_template_block;
export const post_Create_internal_template_block = {
  method: z.literal('POST'),
  path: z.literal('/v1/_internal_templates/blocks'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: InternalTemplateBlockCreate,
  }),
  response: Block,
};

export type post_Create_internal_template_blocks_batch =
  typeof post_Create_internal_template_blocks_batch;
export const post_Create_internal_template_blocks_batch = {
  method: z.literal('POST'),
  path: z.literal('/v1/_internal_templates/blocks/batch'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.array(InternalTemplateBlockCreate),
  }),
  response: z.array(Block),
};

export type get_List_deployment_entities = typeof get_List_deployment_entities;
export const get_List_deployment_entities = {
  method: z.literal('GET'),
  path: z.literal('/v1/_internal_templates/deployment/{deployment_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      entity_types: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
    }),
    path: z.object({
      deployment_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: ListDeploymentEntitiesResponse,
};

export type delete_Delete_deployment = typeof delete_Delete_deployment;
export const delete_Delete_deployment = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/_internal_templates/deployment/{deployment_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      deployment_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: DeleteDeploymentResponse,
};

export type get_List_models = typeof get_List_models;
export const get_List_models = {
  method: z.literal('GET'),
  path: z.literal('/v1/models/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      provider_category: z
        .union([
          z.array(ProviderCategory),
          z.null(),
          z.array(z.union([z.array(ProviderCategory), z.null()])),
        ])
        .optional(),
      provider_name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      provider_type: z
        .union([
          ProviderType,
          z.null(),
          z.array(z.union([ProviderType, z.null()])),
        ])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(LLMConfig),
};

export type get_List_embedding_models = typeof get_List_embedding_models;
export const get_List_embedding_models = {
  method: z.literal('GET'),
  path: z.literal('/v1/models/embedding'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(EmbeddingConfig),
};

export type get_List_blocks = typeof get_List_blocks;
export const get_List_blocks = {
  method: z.literal('GET'),
  path: z.literal('/v1/blocks/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      label: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      templates_only: z.boolean().optional(),
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      identity_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      identifier_keys: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      project_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      label_search: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      description_search: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      value_search: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      connected_to_agents_count_gt: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      connected_to_agents_count_lt: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      connected_to_agents_count_eq: z
        .union([
          z.array(z.number()),
          z.null(),
          z.array(z.union([z.array(z.number()), z.null()])),
        ])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Block),
};

export type post_Create_block = typeof post_Create_block;
export const post_Create_block = {
  method: z.literal('POST'),
  path: z.literal('/v1/blocks/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: CreateBlock,
  }),
  response: Block,
};

export type get_Count_blocks = typeof get_Count_blocks;
export const get_Count_blocks = {
  method: z.literal('GET'),
  path: z.literal('/v1/blocks/count'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.number(),
};

export type patch_Modify_block = typeof patch_Modify_block;
export const patch_Modify_block = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/blocks/{block_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      block_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: BlockUpdate,
  }),
  response: Block,
};

export type delete_Delete_block = typeof delete_Delete_block;
export const delete_Delete_block = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/blocks/{block_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      block_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type get_Retrieve_block = typeof get_Retrieve_block;
export const get_Retrieve_block = {
  method: z.literal('GET'),
  path: z.literal('/v1/blocks/{block_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      block_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Block,
};

export type get_List_agents_for_block = typeof get_List_agents_for_block;
export const get_List_agents_for_block = {
  method: z.literal('GET'),
  path: z.literal('/v1/blocks/{block_id}/agents'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      include_relationships: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
    }),
    path: z.object({
      block_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(AgentState),
};

export type get_List_jobs = typeof get_List_jobs;
export const get_List_jobs = {
  method: z.literal('GET'),
  path: z.literal('/v1/jobs/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      source_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      active: z.boolean().optional(),
      ascending: z.boolean().optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Job),
};

export type get_Retrieve_job = typeof get_Retrieve_job;
export const get_Retrieve_job = {
  method: z.literal('GET'),
  path: z.literal('/v1/jobs/{job_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      job_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Job,
};

export type delete_Delete_job = typeof delete_Delete_job;
export const delete_Delete_job = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/jobs/{job_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      job_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Job,
};

export type patch_Cancel_job = typeof patch_Cancel_job;
export const patch_Cancel_job = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/jobs/{job_id}/cancel'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      job_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Job,
};

export type get_Check_health = typeof get_Check_health;
export const get_Check_health = {
  method: z.literal('GET'),
  path: z.literal('/v1/health/'),
  requestFormat: z.literal('json'),
  parameters: z.never(),
  response: Health,
};

export type post_Create_sandbox_config_v1_sandbox_config__post =
  typeof post_Create_sandbox_config_v1_sandbox_config__post;
export const post_Create_sandbox_config_v1_sandbox_config__post = {
  method: z.literal('POST'),
  path: z.literal('/v1/sandbox-config/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: SandboxConfigCreate,
  }),
  response: SandboxConfig,
};

export type get_List_sandbox_configs_v1_sandbox_config__get =
  typeof get_List_sandbox_configs_v1_sandbox_config__get;
export const get_List_sandbox_configs_v1_sandbox_config__get = {
  method: z.literal('GET'),
  path: z.literal('/v1/sandbox-config/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      limit: z.number().optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      sandbox_type: z
        .union([
          SandboxType,
          z.null(),
          z.array(z.union([SandboxType, z.null()])),
        ])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(SandboxConfig),
};

export type post_Create_default_e2b_sandbox_config_v1_sandbox_config_e2b_default_post =
  typeof post_Create_default_e2b_sandbox_config_v1_sandbox_config_e2b_default_post;
export const post_Create_default_e2b_sandbox_config_v1_sandbox_config_e2b_default_post =
  {
    method: z.literal('POST'),
    path: z.literal('/v1/sandbox-config/e2b/default'),
    requestFormat: z.literal('json'),
    parameters: z.object({
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
    }),
    response: SandboxConfig,
  };

export type post_Create_default_local_sandbox_config_v1_sandbox_config_local_default_post =
  typeof post_Create_default_local_sandbox_config_v1_sandbox_config_local_default_post;
export const post_Create_default_local_sandbox_config_v1_sandbox_config_local_default_post =
  {
    method: z.literal('POST'),
    path: z.literal('/v1/sandbox-config/local/default'),
    requestFormat: z.literal('json'),
    parameters: z.object({
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
    }),
    response: SandboxConfig,
  };

export type post_Create_custom_local_sandbox_config_v1_sandbox_config_local_post =
  typeof post_Create_custom_local_sandbox_config_v1_sandbox_config_local_post;
export const post_Create_custom_local_sandbox_config_v1_sandbox_config_local_post =
  {
    method: z.literal('POST'),
    path: z.literal('/v1/sandbox-config/local'),
    requestFormat: z.literal('json'),
    parameters: z.object({
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
      body: LocalSandboxConfig,
    }),
    response: SandboxConfig,
  };

export type patch_Update_sandbox_config_v1_sandbox_config__sandbox_config_id__patch =
  typeof patch_Update_sandbox_config_v1_sandbox_config__sandbox_config_id__patch;
export const patch_Update_sandbox_config_v1_sandbox_config__sandbox_config_id__patch =
  {
    method: z.literal('PATCH'),
    path: z.literal('/v1/sandbox-config/{sandbox_config_id}'),
    requestFormat: z.literal('json'),
    parameters: z.object({
      path: z.object({
        sandbox_config_id: z.string(),
      }),
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
      body: SandboxConfigUpdate,
    }),
    response: SandboxConfig,
  };

export type delete_Delete_sandbox_config_v1_sandbox_config__sandbox_config_id__delete =
  typeof delete_Delete_sandbox_config_v1_sandbox_config__sandbox_config_id__delete;
export const delete_Delete_sandbox_config_v1_sandbox_config__sandbox_config_id__delete =
  {
    method: z.literal('DELETE'),
    path: z.literal('/v1/sandbox-config/{sandbox_config_id}'),
    requestFormat: z.literal('json'),
    parameters: z.object({
      path: z.object({
        sandbox_config_id: z.string(),
      }),
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
    }),
    response: z.unknown(),
  };

export type post_Force_recreate_local_sandbox_venv_v1_sandbox_config_local_recreate_venv_post =
  typeof post_Force_recreate_local_sandbox_venv_v1_sandbox_config_local_recreate_venv_post;
export const post_Force_recreate_local_sandbox_venv_v1_sandbox_config_local_recreate_venv_post =
  {
    method: z.literal('POST'),
    path: z.literal('/v1/sandbox-config/local/recreate-venv'),
    requestFormat: z.literal('json'),
    parameters: z.object({
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
    }),
    response: SandboxConfig,
  };

export type post_Create_sandbox_env_var_v1_sandbox_config__sandbox_config_id__environment_variable_post =
  typeof post_Create_sandbox_env_var_v1_sandbox_config__sandbox_config_id__environment_variable_post;
export const post_Create_sandbox_env_var_v1_sandbox_config__sandbox_config_id__environment_variable_post =
  {
    method: z.literal('POST'),
    path: z.literal(
      '/v1/sandbox-config/{sandbox_config_id}/environment-variable',
    ),
    requestFormat: z.literal('json'),
    parameters: z.object({
      path: z.object({
        sandbox_config_id: z.string(),
      }),
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
      body: SandboxEnvironmentVariableCreate,
    }),
    response: SandboxEnvironmentVariable,
  };

export type get_List_sandbox_env_vars_v1_sandbox_config__sandbox_config_id__environment_variable_get =
  typeof get_List_sandbox_env_vars_v1_sandbox_config__sandbox_config_id__environment_variable_get;
export const get_List_sandbox_env_vars_v1_sandbox_config__sandbox_config_id__environment_variable_get =
  {
    method: z.literal('GET'),
    path: z.literal(
      '/v1/sandbox-config/{sandbox_config_id}/environment-variable',
    ),
    requestFormat: z.literal('json'),
    parameters: z.object({
      query: z.object({
        limit: z.number().optional(),
        after: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
      path: z.object({
        sandbox_config_id: z.string(),
      }),
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
    }),
    response: z.array(SandboxEnvironmentVariable),
  };

export type patch_Update_sandbox_env_var_v1_sandbox_config_environment_variable__env_var_id__patch =
  typeof patch_Update_sandbox_env_var_v1_sandbox_config_environment_variable__env_var_id__patch;
export const patch_Update_sandbox_env_var_v1_sandbox_config_environment_variable__env_var_id__patch =
  {
    method: z.literal('PATCH'),
    path: z.literal('/v1/sandbox-config/environment-variable/{env_var_id}'),
    requestFormat: z.literal('json'),
    parameters: z.object({
      path: z.object({
        env_var_id: z.string(),
      }),
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
      body: SandboxEnvironmentVariableUpdate,
    }),
    response: SandboxEnvironmentVariable,
  };

export type delete_Delete_sandbox_env_var_v1_sandbox_config_environment_variable__env_var_id__delete =
  typeof delete_Delete_sandbox_env_var_v1_sandbox_config_environment_variable__env_var_id__delete;
export const delete_Delete_sandbox_env_var_v1_sandbox_config_environment_variable__env_var_id__delete =
  {
    method: z.literal('DELETE'),
    path: z.literal('/v1/sandbox-config/environment-variable/{env_var_id}'),
    requestFormat: z.literal('json'),
    parameters: z.object({
      path: z.object({
        env_var_id: z.string(),
      }),
      header: z.object({
        user_id: z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'User-Agent': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Project-Id': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
        'X-Experimental-Message-Async': z
          .union([
            z.string(),
            z.null(),
            z.array(z.union([z.string(), z.null()])),
          ])
          .optional(),
      }),
    }),
    response: z.unknown(),
  };

export type get_List_providers = typeof get_List_providers;
export const get_List_providers = {
  method: z.literal('GET'),
  path: z.literal('/v1/providers/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      provider_type: z
        .union([
          ProviderType,
          z.null(),
          z.array(z.union([ProviderType, z.null()])),
        ])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Provider),
};

export type post_Create_provider = typeof post_Create_provider;
export const post_Create_provider = {
  method: z.literal('POST'),
  path: z.literal('/v1/providers/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ProviderCreate,
  }),
  response: Provider,
};

export type get_Retrieve_provider = typeof get_Retrieve_provider;
export const get_Retrieve_provider = {
  method: z.literal('GET'),
  path: z.literal('/v1/providers/{provider_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      provider_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Provider,
};

export type patch_Modify_provider = typeof patch_Modify_provider;
export const patch_Modify_provider = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/providers/{provider_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      provider_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ProviderUpdate,
  }),
  response: Provider,
};

export type delete_Delete_provider = typeof delete_Delete_provider;
export const delete_Delete_provider = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/providers/{provider_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      provider_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Check_provider = typeof post_Check_provider;
export const post_Check_provider = {
  method: z.literal('POST'),
  path: z.literal('/v1/providers/check'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    body: ProviderCheck,
  }),
  response: z.unknown(),
};

export type get_List_runs = typeof get_List_runs;
export const get_List_runs = {
  method: z.literal('GET'),
  path: z.literal('/v1/runs/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      agent_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      agent_ids: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      background: z
        .union([
          z.boolean(),
          z.null(),
          z.array(z.union([z.boolean(), z.null()])),
        ])
        .optional(),
      stop_reason: z
        .union([
          StopReasonType,
          z.null(),
          z.array(z.union([StopReasonType, z.null()])),
        ])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      active: z.boolean().optional(),
      ascending: z.boolean().optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Run),
};

export type get_Retrieve_run = typeof get_Retrieve_run;
export const get_Retrieve_run = {
  method: z.literal('GET'),
  path: z.literal('/v1/runs/{run_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      run_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Run,
};

export type delete_Delete_run = typeof delete_Delete_run;
export const delete_Delete_run = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/runs/{run_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      run_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Run,
};

export type get_List_run_messages = typeof get_List_run_messages;
export const get_List_run_messages = {
  method: z.literal('GET'),
  path: z.literal('/v1/runs/{run_id}/messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
    }),
    path: z.object({
      run_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(LettaMessageUnion),
};

export type get_Retrieve_run_usage = typeof get_Retrieve_run_usage;
export const get_Retrieve_run_usage = {
  method: z.literal('GET'),
  path: z.literal('/v1/runs/{run_id}/usage'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      run_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: UsageStatistics,
};

export type get_List_run_steps = typeof get_List_run_steps;
export const get_List_run_steps = {
  method: z.literal('GET'),
  path: z.literal('/v1/runs/{run_id}/steps'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.string().optional(),
    }),
    path: z.object({
      run_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Step),
};

export type post_Retrieve_stream = typeof post_Retrieve_stream;
export const post_Retrieve_stream = {
  method: z.literal('POST'),
  path: z.literal('/v1/runs/{run_id}/stream'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      run_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: RetrieveStreamRequest,
  }),
  response: z.unknown(),
};

export type get_List_steps = typeof get_List_steps;
export const get_List_steps = {
  method: z.literal('GET'),
  path: z.literal('/v1/steps/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      start_date: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      end_date: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      model: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      agent_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      trace_ids: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      feedback: z
        .union([
          z.literal('positive'),
          z.literal('negative'),
          z.null(),
          z.array(
            z.union([z.literal('positive'), z.literal('negative'), z.null()]),
          ),
        ])
        .optional(),
      has_feedback: z
        .union([
          z.boolean(),
          z.null(),
          z.array(z.union([z.boolean(), z.null()])),
        ])
        .optional(),
      tags: z
        .union([
          z.array(z.string()),
          z.null(),
          z.array(z.union([z.array(z.string()), z.null()])),
        ])
        .optional(),
      project_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    header: z.object({
      'X-Project': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Step),
};

export type get_Retrieve_step = typeof get_Retrieve_step;
export const get_Retrieve_step = {
  method: z.literal('GET'),
  path: z.literal('/v1/steps/{step_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      step_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Step,
};

export type get_Retrieve_metrics_for_step =
  typeof get_Retrieve_metrics_for_step;
export const get_Retrieve_metrics_for_step = {
  method: z.literal('GET'),
  path: z.literal('/v1/steps/{step_id}/metrics'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      step_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: StepMetrics,
};

export type get_Retrieve_trace_for_step = typeof get_Retrieve_trace_for_step;
export const get_Retrieve_trace_for_step = {
  method: z.literal('GET'),
  path: z.literal('/v1/steps/{step_id}/trace'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      step_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.union([
    ProviderTrace,
    z.null(),
    z.array(z.union([ProviderTrace, z.null()])),
  ]),
};

export type patch_Modify_feedback_for_step =
  typeof patch_Modify_feedback_for_step;
export const patch_Modify_feedback_for_step = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/steps/{step_id}/feedback'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      step_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: ModifyFeedbackRequest,
  }),
  response: Step,
};

export type get_List_messages_for_step = typeof get_List_messages_for_step;
export const get_List_messages_for_step = {
  method: z.literal('GET'),
  path: z.literal('/v1/steps/{step_id}/messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
    }),
    path: z.object({
      step_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(
    z.union([
      SystemMessage,
      UserMessage,
      ReasoningMessage,
      HiddenReasoningMessage,
      ToolCallMessage,
      ToolReturnMessage,
      AssistantMessage,
      ApprovalRequestMessage,
      ApprovalResponseMessage,
    ]),
  ),
};

export type patch_Update_step_transaction_id =
  typeof patch_Update_step_transaction_id;
export const patch_Update_step_transaction_id = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/steps/{step_id}/transaction/{transaction_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      step_id: z.string(),
      transaction_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: Step,
};

export type get_List_tags = typeof get_List_tags;
export const get_List_tags = {
  method: z.literal('GET'),
  path: z.literal('/v1/tags/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      query_text: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      name: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(z.string()),
};

export type post_Create_batch = typeof post_Create_batch;
export const post_Create_batch = {
  method: z.literal('POST'),
  path: z.literal('/v1/messages/batches'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: CreateBatch,
  }),
  response: BatchJob,
};

export type get_List_batches = typeof get_List_batches;
export const get_List_batches = {
  method: z.literal('GET'),
  path: z.literal('/v1/messages/batches'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(BatchJob),
};

export type get_Retrieve_batch = typeof get_Retrieve_batch;
export const get_Retrieve_batch = {
  method: z.literal('GET'),
  path: z.literal('/v1/messages/batches/{batch_id}'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      batch_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: BatchJob,
};

export type get_List_messages_for_batch = typeof get_List_messages_for_batch;
export const get_List_messages_for_batch = {
  method: z.literal('GET'),
  path: z.literal('/v1/messages/batches/{batch_id}/messages'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      before: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
      order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
      order_by: z.string().optional(),
      agent_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    path: z.object({
      batch_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: LettaBatchMessages,
};

export type patch_Cancel_batch = typeof patch_Cancel_batch;
export const patch_Cancel_batch = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/messages/batches/{batch_id}/cancel'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      batch_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.unknown(),
};

export type post_Create_voice_chat_completions =
  typeof post_Create_voice_chat_completions;
export const post_Create_voice_chat_completions = {
  method: z.literal('POST'),
  path: z.literal('/v1/voice-beta/{agent_id}/chat/completions'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    path: z.object({
      agent_id: z.string(),
    }),
    header: z.object({
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
    body: z.unknown(),
  }),
  response: z.unknown(),
};

export type get_Get_total_storage_size = typeof get_Get_total_storage_size;
export const get_Get_total_storage_size = {
  method: z.literal('GET'),
  path: z.literal('/v1/embeddings/total_storage_size'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    header: z.object({
      'storage-unit': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      user_id: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'User-Agent': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Project-Id': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      'X-Experimental-Message-Async': z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.number(),
};

export type get_List_users = typeof get_List_users;
export const get_List_users = {
  method: z.literal('GET'),
  path: z.literal('/v1/admin/users/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(User),
};

export type post_Create_user = typeof post_Create_user;
export const post_Create_user = {
  method: z.literal('POST'),
  path: z.literal('/v1/admin/users/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    body: UserCreate,
  }),
  response: User,
};

export type put_Update_user = typeof put_Update_user;
export const put_Update_user = {
  method: z.literal('PUT'),
  path: z.literal('/v1/admin/users/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    body: UserUpdate,
  }),
  response: User,
};

export type delete_Delete_user = typeof delete_Delete_user;
export const delete_Delete_user = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/admin/users/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      user_id: z.string(),
    }),
  }),
  response: User,
};

export type get_List_orgs = typeof get_List_orgs;
export const get_List_orgs = {
  method: z.literal('GET'),
  path: z.literal('/v1/admin/orgs/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      after: z
        .union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])
        .optional(),
      limit: z
        .union([z.number(), z.null(), z.array(z.union([z.number(), z.null()]))])
        .optional(),
    }),
  }),
  response: z.array(Organization),
};

export type post_Create_organization = typeof post_Create_organization;
export const post_Create_organization = {
  method: z.literal('POST'),
  path: z.literal('/v1/admin/orgs/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    body: OrganizationCreate,
  }),
  response: Organization,
};

export type delete_Delete_organization_by_id =
  typeof delete_Delete_organization_by_id;
export const delete_Delete_organization_by_id = {
  method: z.literal('DELETE'),
  path: z.literal('/v1/admin/orgs/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      org_id: z.string(),
    }),
  }),
  response: Organization,
};

export type patch_Update_organization = typeof patch_Update_organization;
export const patch_Update_organization = {
  method: z.literal('PATCH'),
  path: z.literal('/v1/admin/orgs/'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    query: z.object({
      org_id: z.string(),
    }),
    body: OrganizationUpdate,
  }),
  response: Organization,
};

export type post_Authenticate_user_v1_auth_post =
  typeof post_Authenticate_user_v1_auth_post;
export const post_Authenticate_user_v1_auth_post = {
  method: z.literal('POST'),
  path: z.literal('/v1/auth'),
  requestFormat: z.literal('json'),
  parameters: z.object({
    body: AuthRequest,
  }),
  response: AuthResponse,
};

// <EndpointByMethod>
export const EndpointByMethod = {
  post: {
    '/v1/archives/': post_Create_archive,
    '/v1/tools/': post_Create_tool,
    '/v1/tools/add-base-tools': post_Add_base_tools,
    '/v1/tools/run': post_Run_tool_from_source,
    '/v1/tools/composio/{composio_action_name}': post_Add_composio_tool,
    '/v1/tools/mcp/servers/{mcp_server_name}/resync':
      post_Resync_mcp_server_tools,
    '/v1/tools/mcp/servers/{mcp_server_name}/{mcp_tool_name}':
      post_Add_mcp_tool,
    '/v1/tools/mcp/servers/test': post_Test_mcp_server,
    '/v1/tools/mcp/servers/connect': post_Connect_mcp_server,
    '/v1/tools/generate-schema': post_Generate_json_schema,
    '/v1/tools/mcp/servers/{mcp_server_name}/tools/{tool_name}/execute':
      post_Execute_mcp_tool,
    '/v1/tools/generate-tool': post_Generate_tool,
    '/v1/folders/': post_Create_folder,
    '/v1/folders/{folder_id}/upload': post_Upload_file_to_folder,
    '/v1/agents/': post_Create_agent,
    '/v1/agents/import': post_Import_agent,
    '/v1/agents/{agent_id}/archival-memory': post_Create_passage,
    '/v1/agents/{agent_id}/messages': post_Send_message,
    '/v1/agents/{agent_id}/messages/stream': post_Create_agent_message_stream,
    '/v1/agents/{agent_id}/messages/cancel': post_Cancel_agent_run,
    '/v1/agents/messages/search': post_Search_messages,
    '/v1/agents/{agent_id}/messages/async': post_Create_agent_message_async,
    '/v1/agents/{agent_id}/messages/preview-raw-payload':
      post_Preview_raw_payload,
    '/v1/agents/{agent_id}/summarize': post_Summarize_agent_conversation,
    '/v1/groups/': post_Create_group,
    '/v1/groups/{group_id}/messages': post_Send_group_message,
    '/v1/groups/{group_id}/messages/stream': post_Send_group_message_streaming,
    '/v1/identities/': post_Create_identity,
    '/v1/_internal_templates/groups': post_Create_internal_template_group,
    '/v1/_internal_templates/agents': post_Create_internal_template_agent,
    '/v1/_internal_templates/blocks': post_Create_internal_template_block,
    '/v1/_internal_templates/blocks/batch':
      post_Create_internal_template_blocks_batch,
    '/v1/blocks/': post_Create_block,
    '/v1/sandbox-config/': post_Create_sandbox_config_v1_sandbox_config__post,
    '/v1/sandbox-config/e2b/default':
      post_Create_default_e2b_sandbox_config_v1_sandbox_config_e2b_default_post,
    '/v1/sandbox-config/local/default':
      post_Create_default_local_sandbox_config_v1_sandbox_config_local_default_post,
    '/v1/sandbox-config/local':
      post_Create_custom_local_sandbox_config_v1_sandbox_config_local_post,
    '/v1/sandbox-config/local/recreate-venv':
      post_Force_recreate_local_sandbox_venv_v1_sandbox_config_local_recreate_venv_post,
    '/v1/sandbox-config/{sandbox_config_id}/environment-variable':
      post_Create_sandbox_env_var_v1_sandbox_config__sandbox_config_id__environment_variable_post,
    '/v1/providers/': post_Create_provider,
    '/v1/providers/check': post_Check_provider,
    '/v1/runs/{run_id}/stream': post_Retrieve_stream,
    '/v1/messages/batches': post_Create_batch,
    '/v1/voice-beta/{agent_id}/chat/completions':
      post_Create_voice_chat_completions,
    '/v1/admin/users/': post_Create_user,
    '/v1/admin/orgs/': post_Create_organization,
    '/v1/auth': post_Authenticate_user_v1_auth_post,
  },
  get: {
    '/v1/archives/': get_List_archives,
    '/v1/tools/{tool_id}': get_Retrieve_tool,
    '/v1/tools/count': get_Count_tools,
    '/v1/tools/': get_List_tools,
    '/v1/tools/composio/apps': get_List_composio_apps,
    '/v1/tools/composio/apps/{composio_app_name}/actions':
      get_List_composio_actions_by_app,
    '/v1/tools/mcp/servers': get_List_mcp_servers,
    '/v1/tools/mcp/servers/{mcp_server_name}/tools':
      get_List_mcp_tools_by_server,
    '/v1/tools/mcp/oauth/callback/{session_id}': get_Mcp_oauth_callback,
    '/v1/folders/count': get_Count_folders,
    '/v1/folders/{folder_id}': get_Retrieve_folder,
    '/v1/folders/metadata': get_Retrieve_metadata,
    '/v1/folders/': get_List_folders,
    '/v1/folders/{folder_id}/agents': get_List_agents_for_folder,
    '/v1/folders/{folder_id}/passages': get_List_folder_passages,
    '/v1/folders/{folder_id}/files': get_List_folder_files,
    '/v1/agents/': get_List_agents,
    '/v1/agents/count': get_Count_agents,
    '/v1/agents/{agent_id}/export': get_Export_agent,
    '/v1/agents/{agent_id}/context': get_Retrieve_agent_context_window,
    '/v1/agents/{agent_id}': get_Retrieve_agent,
    '/v1/agents/{agent_id}/tools': get_List_agent_tools,
    '/v1/agents/{agent_id}/sources': get_List_agent_sources,
    '/v1/agents/{agent_id}/folders': get_List_agent_folders,
    '/v1/agents/{agent_id}/files': get_List_agent_files,
    '/v1/agents/{agent_id}/core-memory': get_Retrieve_agent_memory,
    '/v1/agents/{agent_id}/core-memory/blocks/{block_label}':
      get_Retrieve_core_memory_block,
    '/v1/agents/{agent_id}/core-memory/blocks': get_List_core_memory_blocks,
    '/v1/agents/{agent_id}/archival-memory': get_List_passages,
    '/v1/agents/{agent_id}/archival-memory/search': get_Search_archival_memory,
    '/v1/agents/{agent_id}/messages': get_List_messages,
    '/v1/agents/{agent_id}/groups': get_List_agent_groups,
    '/v1/groups/': get_List_groups,
    '/v1/groups/count': get_Count_groups,
    '/v1/groups/{group_id}': get_Retrieve_group,
    '/v1/groups/{group_id}/messages': get_List_group_messages,
    '/v1/identities/': get_List_identities,
    '/v1/identities/count': get_Count_identities,
    '/v1/identities/{identity_id}': get_Retrieve_identity,
    '/v1/identities/{identity_id}/agents': get_List_agents_for_identity,
    '/v1/identities/{identity_id}/blocks': get_List_blocks_for_identity,
    '/v1/_internal_templates/deployment/{deployment_id}':
      get_List_deployment_entities,
    '/v1/models/': get_List_models,
    '/v1/models/embedding': get_List_embedding_models,
    '/v1/blocks/': get_List_blocks,
    '/v1/blocks/count': get_Count_blocks,
    '/v1/blocks/{block_id}': get_Retrieve_block,
    '/v1/blocks/{block_id}/agents': get_List_agents_for_block,
    '/v1/jobs/': get_List_jobs,
    '/v1/jobs/{job_id}': get_Retrieve_job,
    '/v1/health/': get_Check_health,
    '/v1/sandbox-config/': get_List_sandbox_configs_v1_sandbox_config__get,
    '/v1/sandbox-config/{sandbox_config_id}/environment-variable':
      get_List_sandbox_env_vars_v1_sandbox_config__sandbox_config_id__environment_variable_get,
    '/v1/providers/': get_List_providers,
    '/v1/providers/{provider_id}': get_Retrieve_provider,
    '/v1/runs/': get_List_runs,
    '/v1/runs/{run_id}': get_Retrieve_run,
    '/v1/runs/{run_id}/messages': get_List_run_messages,
    '/v1/runs/{run_id}/usage': get_Retrieve_run_usage,
    '/v1/runs/{run_id}/steps': get_List_run_steps,
    '/v1/steps/': get_List_steps,
    '/v1/steps/{step_id}': get_Retrieve_step,
    '/v1/steps/{step_id}/metrics': get_Retrieve_metrics_for_step,
    '/v1/steps/{step_id}/trace': get_Retrieve_trace_for_step,
    '/v1/steps/{step_id}/messages': get_List_messages_for_step,
    '/v1/tags/': get_List_tags,
    '/v1/messages/batches': get_List_batches,
    '/v1/messages/batches/{batch_id}': get_Retrieve_batch,
    '/v1/messages/batches/{batch_id}/messages': get_List_messages_for_batch,
    '/v1/embeddings/total_storage_size': get_Get_total_storage_size,
    '/v1/admin/users/': get_List_users,
    '/v1/admin/orgs/': get_List_orgs,
  },
  patch: {
    '/v1/archives/{archive_id}': patch_Modify_archive,
    '/v1/tools/{tool_id}': patch_Modify_tool,
    '/v1/tools/mcp/servers/{mcp_server_name}': patch_Update_mcp_server,
    '/v1/folders/{folder_id}': patch_Modify_folder,
    '/v1/agents/{agent_id}': patch_Modify_agent,
    '/v1/agents/{agent_id}/tools/attach/{tool_id}': patch_Attach_tool,
    '/v1/agents/{agent_id}/tools/detach/{tool_id}': patch_Detach_tool,
    '/v1/agents/{agent_id}/tools/approval/{tool_name}': patch_Modify_approval,
    '/v1/agents/{agent_id}/sources/attach/{source_id}':
      patch_Attach_source_to_agent,
    '/v1/agents/{agent_id}/folders/attach/{folder_id}':
      patch_Attach_folder_to_agent,
    '/v1/agents/{agent_id}/sources/detach/{source_id}':
      patch_Detach_source_from_agent,
    '/v1/agents/{agent_id}/folders/detach/{folder_id}':
      patch_Detach_folder_from_agent,
    '/v1/agents/{agent_id}/files/close-all': patch_Close_all_open_files,
    '/v1/agents/{agent_id}/files/{file_id}/open': patch_Open_file,
    '/v1/agents/{agent_id}/files/{file_id}/close': patch_Close_file,
    '/v1/agents/{agent_id}/core-memory/blocks/{block_label}':
      patch_Modify_core_memory_block,
    '/v1/agents/{agent_id}/core-memory/blocks/attach/{block_id}':
      patch_Attach_core_memory_block,
    '/v1/agents/{agent_id}/core-memory/blocks/detach/{block_id}':
      patch_Detach_core_memory_block,
    '/v1/agents/{agent_id}/messages/{message_id}': patch_Modify_message,
    '/v1/agents/{agent_id}/reset-messages': patch_Reset_messages,
    '/v1/groups/{group_id}': patch_Modify_group,
    '/v1/groups/{group_id}/messages/{message_id}': patch_Modify_group_message,
    '/v1/groups/{group_id}/reset-messages': patch_Reset_group_messages,
    '/v1/identities/{identity_id}': patch_Update_identity,
    '/v1/blocks/{block_id}': patch_Modify_block,
    '/v1/jobs/{job_id}/cancel': patch_Cancel_job,
    '/v1/sandbox-config/{sandbox_config_id}':
      patch_Update_sandbox_config_v1_sandbox_config__sandbox_config_id__patch,
    '/v1/sandbox-config/environment-variable/{env_var_id}':
      patch_Update_sandbox_env_var_v1_sandbox_config_environment_variable__env_var_id__patch,
    '/v1/providers/{provider_id}': patch_Modify_provider,
    '/v1/steps/{step_id}/feedback': patch_Modify_feedback_for_step,
    '/v1/steps/{step_id}/transaction/{transaction_id}':
      patch_Update_step_transaction_id,
    '/v1/messages/batches/{batch_id}/cancel': patch_Cancel_batch,
    '/v1/admin/orgs/': patch_Update_organization,
  },
  delete: {
    '/v1/tools/{tool_id}': delete_Delete_tool,
    '/v1/tools/mcp/servers/{mcp_server_name}': delete_Delete_mcp_server,
    '/v1/folders/{folder_id}': delete_Delete_folder,
    '/v1/folders/{folder_id}/{file_id}': delete_Delete_file_from_folder,
    '/v1/agents/{agent_id}': delete_Delete_agent,
    '/v1/agents/{agent_id}/archival-memory/{memory_id}': delete_Delete_passage,
    '/v1/groups/{group_id}': delete_Delete_group,
    '/v1/identities/{identity_id}': delete_Delete_identity,
    '/v1/_internal_templates/deployment/{deployment_id}':
      delete_Delete_deployment,
    '/v1/blocks/{block_id}': delete_Delete_block,
    '/v1/jobs/{job_id}': delete_Delete_job,
    '/v1/sandbox-config/{sandbox_config_id}':
      delete_Delete_sandbox_config_v1_sandbox_config__sandbox_config_id__delete,
    '/v1/sandbox-config/environment-variable/{env_var_id}':
      delete_Delete_sandbox_env_var_v1_sandbox_config_environment_variable__env_var_id__delete,
    '/v1/providers/{provider_id}': delete_Delete_provider,
    '/v1/runs/{run_id}': delete_Delete_run,
    '/v1/admin/users/': delete_Delete_user,
    '/v1/admin/orgs/': delete_Delete_organization_by_id,
  },
  put: {
    '/v1/tools/': put_Upsert_tool,
    '/v1/tools/mcp/servers': put_Add_mcp_server,
    '/v1/identities/': put_Upsert_identity,
    '/v1/identities/{identity_id}/properties': put_Upsert_identity_properties,
    '/v1/admin/users/': put_Update_user,
  },
};
export type EndpointByMethod = typeof EndpointByMethod;
// </EndpointByMethod>

// <EndpointByMethod.Shorthands>
export type PostEndpoints = EndpointByMethod['post'];
export type GetEndpoints = EndpointByMethod['get'];
export type PatchEndpoints = EndpointByMethod['patch'];
export type DeleteEndpoints = EndpointByMethod['delete'];
export type PutEndpoints = EndpointByMethod['put'];
export type AllEndpoints = EndpointByMethod[keyof EndpointByMethod];
// </EndpointByMethod.Shorthands>

// <ApiClientTypes>
export type EndpointParameters = {
  body?: unknown;
  query?: Record<string, unknown>;
  header?: Record<string, unknown>;
  path?: Record<string, unknown>;
};

export type MutationMethod = 'post' | 'put' | 'patch' | 'delete';
export type Method = 'get' | 'head' | 'options' | MutationMethod;

type RequestFormat = 'json' | 'form-data' | 'form-url' | 'binary' | 'text';

export type DefaultEndpoint = {
  parameters?: EndpointParameters | undefined;
  response: unknown;
};

export type Endpoint<TConfig extends DefaultEndpoint = DefaultEndpoint> = {
  operationId: string;
  method: Method;
  path: string;
  requestFormat: RequestFormat;
  parameters?: TConfig['parameters'];
  meta: {
    alias: string;
    hasParameters: boolean;
    areParametersRequired: boolean;
  };
  response: TConfig['response'];
};

type Fetcher = (
  method: Method,
  url: string,
  parameters?: EndpointParameters | undefined,
) => Promise<Endpoint['response']>;

type RequiredKeys<T> = {
  [P in keyof T]-?: undefined extends T[P] ? never : P;
}[keyof T];

type MaybeOptionalArg<T> =
  RequiredKeys<T> extends never ? [config?: T] : [config: T];

// </ApiClientTypes>

// <ApiClient>
export class ApiClient {
  baseUrl: string = '';

  constructor(public fetcher: Fetcher) {}

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
    return this;
  }

  // <ApiClient.post>
  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint['parameters']>>
  ): Promise<z.infer<TEndpoint['response']>> {
    return this.fetcher('post', this.baseUrl + path, params[0]) as Promise<
      z.infer<TEndpoint['response']>
    >;
  }
  // </ApiClient.post>

  // <ApiClient.get>
  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint['parameters']>>
  ): Promise<z.infer<TEndpoint['response']>> {
    return this.fetcher('get', this.baseUrl + path, params[0]) as Promise<
      z.infer<TEndpoint['response']>
    >;
  }
  // </ApiClient.get>

  // <ApiClient.patch>
  patch<
    Path extends keyof PatchEndpoints,
    TEndpoint extends PatchEndpoints[Path],
  >(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint['parameters']>>
  ): Promise<z.infer<TEndpoint['response']>> {
    return this.fetcher('patch', this.baseUrl + path, params[0]) as Promise<
      z.infer<TEndpoint['response']>
    >;
  }
  // </ApiClient.patch>

  // <ApiClient.delete>
  delete<
    Path extends keyof DeleteEndpoints,
    TEndpoint extends DeleteEndpoints[Path],
  >(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint['parameters']>>
  ): Promise<z.infer<TEndpoint['response']>> {
    return this.fetcher('delete', this.baseUrl + path, params[0]) as Promise<
      z.infer<TEndpoint['response']>
    >;
  }
  // </ApiClient.delete>

  // <ApiClient.put>
  put<Path extends keyof PutEndpoints, TEndpoint extends PutEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<z.infer<TEndpoint['parameters']>>
  ): Promise<z.infer<TEndpoint['response']>> {
    return this.fetcher('put', this.baseUrl + path, params[0]) as Promise<
      z.infer<TEndpoint['response']>
    >;
  }
  // </ApiClient.put>
}

export function createApiClient(fetcher: Fetcher, baseUrl?: string) {
  return new ApiClient(fetcher).setBaseUrl(baseUrl ?? '');
}

/**
 Example usage:
 const api = createApiClient((method, url, params) =>
   fetch(url, { method, body: JSON.stringify(params) }).then((res) => res.json()),
 );
 api.get("/users").then((users) => console.log(users));
 api.post("/users", { body: { name: "John" } }).then((user) => console.log(user));
 api.put("/users/:id", { path: { id: 1 }, body: { name: "John" } }).then((user) => console.log(user));
*/

// </ApiClient

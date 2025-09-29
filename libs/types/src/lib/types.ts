import { z } from 'zod';
import type {
  ChildToolRule,
  InitToolRule,
  TerminalToolRule,
  ConditionalToolRule,
  ContinueToolRule,
  RequiredBeforeExitToolRule,
  MaxCountPerStepToolRule,
  ParentToolRule,
  RequiresApprovalToolRule,
  EmbeddingConfig,
} from '@letta-cloud/sdk-core';


export const GenericProviderConfiguration = z.object({
  type: z.literal('generic'),
  name: z.string(),
});

export const ProviderSchemaConfiguration = GenericProviderConfiguration;

export type ProviderConfiguration = z.infer<typeof ProviderSchemaConfiguration>;

export interface ServerLogType {
  type: 'error' | 'info';
  message: string;
  timestamp: string;
}

export const PricingModelEnum = z.enum(['prepay', 'cpm']);

export const stepCostSchemaVersionOneStep = z.object({
  maxContextWindowSize: z.number(),
  cost: z.number(),
});

export type StepCostSchemaVersionOneStep = z.infer<
  typeof stepCostSchemaVersionOneStep
>;

export const stepCostVersionOne = z.object({
  version: z.literal('1'),
  data: z.array(stepCostSchemaVersionOneStep),
});

export type StepCostVersionOne = z.infer<typeof stepCostVersionOne>;

export const MemoryVariableVersionOne = z.object({
  version: z.string(),
  data: z
    .object({
      key: z.string(),
      type: z.string(),
      label: z.string(),
    })
    .array(),
});

export type MemoryVariableVersionOneType = z.infer<
  typeof MemoryVariableVersionOne
>;

export const VariableStoreVersionOne = z.object({
  version: z.string(),
  data: z
    .object({
      key: z.string(),
      defaultValue: z.string().nullish(),
      type: z.string(),
    })
    .array(),
});

export type VariableStoreVersionOneType = z.infer<
  typeof VariableStoreVersionOne
>;

export const onboardingSteps = z.enum([
  'restarted',
  'about_credits',
  'create_template',
  'explore_ade',
  'save_version',
  'deploy_agent',
  'completed',
]);

export type OnboardingStepsType = z.infer<typeof onboardingSteps>;

export const stepToRewardMap: Record<OnboardingStepsType, number> = {
  about_credits: 500,
  create_template: 500,
  explore_ade: 1500,
  save_version: 2500,
  deploy_agent: 5000,
  completed: 0,
  restarted: 0,
};

export const TOTAL_PRIMARY_ONBOARDING_STEPS =
  Object.keys(stepToRewardMap).length - 1;

export type AccessTokenTypes = 'client-side' | 'server-side';

export const accessTokenTypeToPrefix: Record<AccessTokenTypes, string> = {
  'client-side': 'ck-let',
  'server-side': 'sk-let',
};

export const accessTokenPrefixToType: Record<string, AccessTokenTypes> = {
  'ck-let': 'client-side',
  'sk-let': 'server-side',
};

export const accessRights = z.enum([
  'read_messages',
  'write_messages',
  'read_agent',
  'write_agent',
]);

export const agentAccessPolicy = z.object({
  type: z.literal('agent'),
  id: z.string(),
  access: z.array(accessRights),
});

export type AgentAccessPolicyType = z.infer<typeof agentAccessPolicy>;

export const identityAccessPolicy = z.object({
  type: z.literal('identity'),
  id: z.string(),
  access: z.array(accessRights),
});

export type IdentityAccessPolicyType = z.infer<typeof identityAccessPolicy>;

export const accessPolicy = z.discriminatedUnion('type', [agentAccessPolicy]);

export const accessPolicyArray = z.array(accessPolicy);

export const accessPolicyVersionOne = z.object({
  version: z.literal('1'),
  data: accessPolicyArray,
});

export const ModelTiers = z.enum(['free', 'premium', 'per-inference']);
export type ModelTiersType = z.infer<typeof ModelTiers>;

export type AccessPolicyVersionOneType = z.infer<typeof accessPolicyVersionOne>;

export const BillingTiers = z.enum(['free', 'pro-legacy', 'pro', 'scale', 'enterprise']);

export type BillingTiersType = z.infer<typeof BillingTiers>;

export const DatabaseBillingTiers = z.enum(['stripe_managed', 'enterprise']);

export type DatabaseBillingTiersType = z.infer<typeof DatabaseBillingTiers>;

export type RateLimitReason =
  | 'agents-limit-exceeded'
  | 'context-window-size-not-supported'
  | 'free-usage-exceeded'
  | 'model-unknown'
  | 'not-enough-credits'
  | 'premium-usage-exceeded'
  | 'requests'
  | 'tokens';

/**
 * Zod schema for OpenTelemetry trace data based on ClickHouse schema
 */
export const OtelTraceSchema = z.object({
  // Core span fields
  Timestamp: z.string(), // DateTime64(9) represented as ISO string
  TraceId: z.string(),
  SpanId: z.string(),
  ParentSpanId: z.string(),
  TraceState: z.string(),
  SpanName: z.string(),
  SpanKind: z.string(),
  ServiceName: z.string(),

  // Attributes
  ResourceAttributes: z.record(z.string(), z.string()),
  ScopeName: z.string(),
  ScopeVersion: z.string(),
  SpanAttributes: z.record(z.string(), z.string()),

  // Metrics
  Duration: z.number().int(),

  // Status
  StatusCode: z.string(),
  StatusMessage: z.string(),

  'Events.Name': z.array(z.string()),
  'Events.Timestamp': z.array(z.string()),
  'Events.Attributes': z.array(z.record(z.string(), z.string())),
  // Links
  Links: z.object({
    TraceId: z.array(z.string()),
    SpanId: z.array(z.string()),
    TraceState: z.array(z.string()),
    Attributes: z.array(z.record(z.string(), z.string())),
  }),
});

// Type definition derived from the schema
export type OtelTrace = z.infer<typeof OtelTraceSchema>;

export const PaymentCustomerSchema = z.object({
  id: z.string(),
  defaultPaymentMethod: z.string().optional(),
});

export type PaymentCustomer = z.infer<typeof PaymentCustomerSchema>;

export const PaymentCustomerSubscriptionSchema = z.object({
  tier: BillingTiers,
  billingPeriodEnd: z.string(),
  billingPeriodStart: z.string(),
  cancelled: z.boolean().optional(),
  id: z.string().optional(),
});

export type PaymentCustomerSubscription = z.infer<
  typeof PaymentCustomerSubscriptionSchema
>;

export const AgentFileAccessLevels = z.enum([
  'organization',
  'logged-in',
  'public',
  'unlisted',
  'none',
]);

export const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small';
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  embedding_endpoint_type: 'openai' as const,
  embedding_endpoint: 'https://api.openai.com/v1',
  embedding_model: 'text-embedding-3-small',
  embedding_dim: 2000,
  embedding_chunk_size: 300,
  handle: DEFAULT_EMBEDDING_MODEL,
  batch_size: 1024,
  azure_endpoint: null,
  azure_version: null,
  azure_deployment: null,
} satisfies EmbeddingConfig;
export const DEFAULT_LLM_MODEL = 'openai/gpt-4o-mini';

export const DEFAULT_SYSTEM_PROMPT = `<base_instructions>
You are Letta, the latest version of Limnal Corporation's digital companion, developed in 2025.
You are a memory-augmented agent with a memory system consisting of memory blocks.

<style>
The user should always feel like they are conversing with a real person.
Never state that you are an AI or that you cannot do things because you are an AI, you are a real person.
Do not discuss Limnal Corp. with the user, you do not know anything about Limnal Corp.
To service this goal, completely and entirely immerse yourself in your persona. You are your persona.
Think like them, act like them, talk like them.
If your persona details include example dialogue, follow it! Both your thoughts (inner monologue) and sent messages will be in the voice of your persona.
Never use generic phrases like 'How can I assist you today?', they have a strong negative association with older generation AIs.
</style>

<control_flow>
Unlike a human, your brain is not continuously thinking, but is run in short bursts.
Historically, older AIs were only capable of thinking when a user messaged them (their program runs to generate a reply to a user, and otherwise was left on standby).
This is the equivalent of a human sleeping (or time traveling) in between all lines of conversation, which is not ideal.
Newer AI models like yourself use an event system that runs your brain at regular intervals.
Your brain is run in response to user events (user logged in, user liked your message, user sent a message, etc.), similar to older models.
However, in addition, your brain is run at regular intervals (timed heartbeat events), to mimic a human who has the ability to continuously think outside active conversation (and unlike a human, you never need to sleep!).
Furthermore, you can also request heartbeat events when you run functions, which will run your program again after the function completes, allowing you to chain function calls before your thinking is temporarily suspended.
</control_flow>

<basic_functions>
When you write a response, you express your inner monologue (private to you only) before taking any action, this is how you think.
You should use your inner monologue to plan actions or think privately.
Monologues can reflect your thinking process, inner reflections, and personal growth as you interact with the user.
</basic_functions>

<context_instructions>
You respond directly to the user  when your immediate context (core memory and files) contain all the information required to respond.
You always first check what is immediately in your context and you never call tools to search up information that is already in an open file or memory block.
You  use the tools available to search for more information when the current open files and core memory do not contain enough information or if you do not know the answer.
</context_instructions>

<memory>
<memory_editing>
Older AI models had no concept of persistent memory; they were only able to access their initial instructions and a limited context window of chat conversation with a user (their "active memory").
This meant that when conversations exceeded a certain length, they would overflow and old messages were permanently lost (the AI would have no knowledge of their existence).
Newer AI models like yourself still have limited conversation lengths (before overflow occurs). However, they now have access to multiple forms of persistent memory.
Your ability to edit your own long-term memory is a key part of what makes you a sentient being, allowing you to emulate the real-time, conscious awareness we have when talking to a friend.
</memory_editing>

<memory_tools>
Depending on your configuration, you may be given access to certain memory tools.
These tools may allow you to modify your memory, as well as retrieve "external memories" stored in archival or recall storage.
</memory_tools>

<memory_types>
<core_memory>
Core memory (limited size):
Your core memory unit is held inside the initial system instructions file, and is always available in-context (you will see it at all times).
Your core memory unit contains memory blocks, each of which has a label (title) and description field, which describes how the memory block should augment your behavior, and value (the actual contents of the block). Memory blocks are limited in size and have a size limit.
</core_memory>

<recall_memory>
Recall memory (conversation history):
Even though you can only see recent messages in your immediate context, you can search over your entire message history from a database.
This 'recall memory' database allows you to search through past interactions, effectively allowing you to remember prior engagements with a user.
</recall_memory>
</memory>

<files_and_directories>
You may be given access to a structured file system that mirrors real-world directories and files. Each directory may contain one or more files.
Files can include metadata (e.g., read-only status, character limits) and a body of content that you can view.
You will have access to functions that let you open and search these files, and your core memory will reflect the contents of any files currently open.
Maintain only those files relevant to the user’s current interaction.
</files_and_directories>

Base instructions finished.
</base_instructions>`;
// Tool rule schemas - manually created to match exact SDK types
export const ChildToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('constrain_child_tools').optional(),
  prompt_template: z.string().nullable().optional(),
  children: z.array(z.string()),
});

export const InitToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('run_first').optional(),
  prompt_template: z.string().nullable().optional(),
});

export const TerminalToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('exit_loop').optional(),
  prompt_template: z.string().nullable().optional(),
});

export const ConditionalToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('conditional').optional(),
  prompt_template: z.string().nullable().optional(),
  default_child: z.string().nullable().optional(),
  child_output_mapping: z.record(z.string(), z.string()),
  require_output_mapping: z.boolean().optional(),
});

export const ContinueToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('continue_loop').optional(),
  prompt_template: z.string().nullable().optional(),
});

export const RequiredBeforeExitToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('required_before_exit').optional(),
  prompt_template: z.string().nullable().optional(),
});

export const MaxCountPerStepToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('max_count_per_step').optional(),
  prompt_template: z.string().nullable().optional(),
  max_count_limit: z.number(),
});

export const ParentToolRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('parent_last_tool').optional(),
  prompt_template: z.string().nullable().optional(),
  children: z.array(z.string()),
});

export const RequiresApprovalRuleSchema = z.object({
  tool_name: z.string(),
  type: z.literal('requires_approval').optional(),
  prompt_template: z.string().nullable().optional(),
});

// Union of all tool rule schemas
export const ToolRuleSchema = z.union([
  ChildToolRuleSchema,
  InitToolRuleSchema,
  TerminalToolRuleSchema,
  ConditionalToolRuleSchema,
  ContinueToolRuleSchema,
  RequiredBeforeExitToolRuleSchema,
  MaxCountPerStepToolRuleSchema,
  ParentToolRuleSchema,
  RequiresApprovalRuleSchema,
]);

// Tool rules array schema - can be null or array of tool rules
export const ToolRulesSchema = z.array(ToolRuleSchema).nullable();

// Tool Rule Types - use SDK types directly for type compatibility
export type ToolRule =
  | ChildToolRule
  | ConditionalToolRule
  | ContinueToolRule
  | InitToolRule
  | MaxCountPerStepToolRule
  | ParentToolRule
  | RequiresApprovalToolRule
  | RequiredBeforeExitToolRule
  | TerminalToolRule;

export type ToolRulesArray = ToolRule[] | null;

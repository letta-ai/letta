import { z } from 'zod';

export const ComposioProviderConfiguration = z.object({
  type: z.literal('composio'),
  name: z.string(),
  enum: z.string(),
  logo: z.string(),
  displayName: z.string(),
  appId: z.string(),
  tags: z.array(z.string()),
});

export const GenericProviderConfiguration = z.object({
  type: z.literal('generic'),
  name: z.string(),
});

export const ProviderSchemaConfiguration = z.union([
  ComposioProviderConfiguration,
  GenericProviderConfiguration,
]);

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
  version: z.literal('1'),
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

export const BillingTiers = z.enum(['free', 'pro', 'scale', 'enterprise']);

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

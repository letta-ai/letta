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

export type AccessPolicyVersionOneType = z.infer<typeof accessPolicyVersionOne>;

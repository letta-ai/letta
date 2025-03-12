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
  'create_template',
  'message_template',
  'edit_template',
  'save_version',
  'deploy_agent',
  'skipped',
  'completed',
]);

export type OnboardingStepsType = z.infer<typeof onboardingSteps>;

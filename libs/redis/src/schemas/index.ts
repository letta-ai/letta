import { z } from 'zod';
import {
  MaxRequestsPerMinutePerModelSchema,
  MaxTokensPerMinutePerModelSchema,
} from '@letta-cloud/database';

interface RedisDefinition<Type extends string, Input, Output> {
  baseKey: Type;
  input: Input;
  getKey: (args: Input) => `${Type}:${string}`;
  output: Output;
}

function generateDefinitionSatisfies<
  Definition extends RedisDefinition<string, any, any>,
>(definition: Definition) {
  return definition;
}

const userSessionDefinition = generateDefinitionSatisfies({
  baseKey: 'userSession',
  input: z.object({ sessionId: z.string() }),
  getKey: (args) => `userSession:${args.sessionId}`,
  output: z.object({
    email: z.string(),
    name: z.string(),
    imageUrl: z.string(),
    activeOrganizationId: z.string(),
    id: z.string(),
  }),
});

const organizationLimitsDefinition = generateDefinitionSatisfies({
  baseKey: 'organizationLimits',
  input: z.object({ organizationId: z.string() }),
  getKey: (args) => `organizationLimits:${args.organizationId}`,
  output: z.object({
    maxRequestsPerMinutePerModel: MaxRequestsPerMinutePerModelSchema.nullable(),
    maxTokensPerMinutePerModel: MaxTokensPerMinutePerModelSchema.nullable(),
  }),
});

const defaultModelRequestPerMinuteDefinition = generateDefinitionSatisfies({
  baseKey: 'defaultModelRequestPerMinute',
  input: z.object({ modelId: z.string() }),
  getKey: (args) => `defaultModelRequestPerMinute:${args.modelId}`,
  output: z.object({ maxRequestsPerMinute: z.number() }),
});

const defaultModelTokenPerMinuteDefinition = generateDefinitionSatisfies({
  baseKey: 'defaultModelTokensPerMinute',
  input: z.object({ modelId: z.string() }),
  getKey: (args) => `defaultModelTokenPerMinuteDefinition:${args.modelId}`,
  output: z.object({ maxTokensPerMinute: z.number() }),
});

const rpmWindowDefinition = generateDefinitionSatisfies({
  baseKey: 'rpmWindow',
  input: z.object({
    modelId: z.string(),
    organizationId: z.string(),
    minute: z.number(),
  }),
  getKey: (args) =>
    `rpmWindow:${args.organizationId}:${args.modelId}:${args.minute}`,
  output: z.object({ data: z.number() }),
});

const tpmWindowDefinition = generateDefinitionSatisfies({
  baseKey: 'tpmWindow',
  input: z.object({
    modelId: z.string(),
    organizationId: z.string(),
    minute: z.number(),
  }),
  getKey: (args) =>
    `tpmWindow:${args.organizationId}:${args.modelId}:${args.minute}`,
  output: z.object({ data: z.number() }),
});

export const redisDefinitions = {
  userSession: userSessionDefinition,
  organizationLimits: organizationLimitsDefinition,
  defaultModelRequestPerMinute: defaultModelRequestPerMinuteDefinition,
  defaultModelTokensPerMinute: defaultModelTokenPerMinuteDefinition,
  rpmWindow: rpmWindowDefinition,
  tpmWindow: tpmWindowDefinition,
} satisfies Record<
  string,
  RedisDefinition<
    string,
    z.ZodObject<any, any, any>,
    z.ZodObject<any, any, any>
  >
>;

export type RedisTypes = keyof typeof redisDefinitions;
export type RedisDefinitionMap = typeof redisDefinitions;

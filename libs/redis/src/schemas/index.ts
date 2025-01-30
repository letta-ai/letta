import { z } from 'zod';
import type { ZodType } from 'zod';
import {
  db,
  MaxRequestsPerMinutePerModelSchema,
  MaxTokensPerMinutePerModelSchema,
  organizationCredits,
  organizations,
} from '@letta-cloud/database';
import { eq } from 'drizzle-orm';

interface RedisDefinition<Type extends string, Input, Output extends ZodType> {
  baseKey: Type;
  input: Input;
  getKey: (args: Input) => `${Type}:${string}`;
  populateOnMissFn?: (
    args: Input,
  ) => Promise<{ expiry: number; data: z.infer<Output> } | null>;
  output: Output;
}

export function hasPopulateOnMissFn(
  definition: RedisDefinition<string, any, any>,
): definition is RedisDefinition<string, any, any> {
  return !!definition.populateOnMissFn;
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

const organizationCreditsDefinition = generateDefinitionSatisfies({
  baseKey: 'organizationCredits',
  input: z.object({ coreOrganizationId: z.string() }),
  getKey: (args) => `organizationCredits:${args.coreOrganizationId}`,
  populateOnMissFn: async (args) => {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.lettaAgentsId, args.coreOrganizationId),
      columns: {
        id: true,
      },
    });

    if (!org) {
      return null;
    }

    const result = await db.query.organizationCredits.findFirst({
      where: eq(organizationCredits.organizationId, org.id),
      columns: {
        credits: true,
      },
    });

    if (!result) {
      return null;
    }

    return { expiry: 24 * 60 * 60, data: { credits: result.credits } };
  },
  output: z.object({ credits: z.number() }),
});

const organizationToCoreOrganizationDefinition = generateDefinitionSatisfies({
  baseKey: 'organizationToCoreOrganization',
  input: z.object({ organizationId: z.string() }),
  getKey: (args) => `organizationToCoreOrganization:${args.organizationId}`,
  populateOnMissFn: async (args) => {
    const result = await db.query.organizations.findFirst({
      where: eq(organizations.id, args.organizationId),
      columns: {
        lettaAgentsId: true,
      },
    });

    if (!result) {
      return null;
    }

    return { expiry: 0, data: { coreOrganizationId: result.lettaAgentsId } };
  },
  output: z.object({ coreOrganizationId: z.string() }),
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
  organizationCredits: organizationCreditsDefinition,
  organizationToCoreOrganization: organizationToCoreOrganizationDefinition,
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

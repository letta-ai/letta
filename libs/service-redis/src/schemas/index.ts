import { z } from 'zod';
import type { ZodType } from 'zod';
import {
  db,
  inferenceModelsMetadata,
  lettaAPIKeys,
  organizations,
  stepCostSchemaTable,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { stepCostVersionOne } from '@letta-cloud/types';

interface RedisDefinition<Type extends string, Input, Output extends ZodType> {
  baseKey: Type;
  input: Input;
  getKey: (args: Input) => `${Type}:${string}`;
  populateOnMissFn?: (
    args: Input,
  ) => Promise<{ expiresAt: number; data: z.infer<Output> } | null>;
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
    coreUserId: z.string(),
  }),
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

    return { expiresAt: 0, data: { coreOrganizationId: result.lettaAgentsId } };
  },
  output: z.object({ coreOrganizationId: z.string() }),
});

const organizationRateLimitsPerModelDefinition = generateDefinitionSatisfies({
  baseKey: 'organizationRateLimits',
  input: z.object({ organizationId: z.string(), modelId: z.string() }),
  getKey: (args) => `organizationLimits:${args.organizationId}:${args.modelId}`,
  output: z.object({
    maxRequestsPerMinutePerModel: z.number(),
    maxTokensPerMinutePerModel: z.number(),
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

const stepCostSchemaDefinition = generateDefinitionSatisfies({
  baseKey: 'stepCostSchema',
  input: z.object({ modelId: z.string() }),
  getKey: (args) => `stepCostSchema:${args.modelId}`,
  output: stepCostVersionOne,
  populateOnMissFn: async (args) => {
    const schema = await db.query.stepCostSchemaTable.findFirst({
      where: eq(stepCostSchemaTable.modelId, args.modelId),
    });

    if (!schema) {
      return null;
    }

    // 24 hours
    return {
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      data: schema.stepCostSchema,
    };
  },
});

const modelNameAndEndpointToIdMapDefinition = generateDefinitionSatisfies({
  baseKey: 'modelNameAndEndpointToIdMap',
  input: z.object({ modelName: z.string(), modelEndpoint: z.string() }),
  getKey: (args) =>
    `modelNameAndEndpointToIdMap:${args.modelName}:${args.modelEndpoint}`,
  output: z.object({ modelId: z.string() }),
  populateOnMissFn: async (args) => {
    const model = await db.query.inferenceModelsMetadata.findFirst({
      where: and(
        eq(inferenceModelsMetadata.modelName, args.modelName),
        eq(inferenceModelsMetadata.modelEndpoint, args.modelEndpoint),
      ),
    });

    if (!model) {
      return null;
    }

    return { expiresAt: 0, data: { modelId: model.id } };
  },
});

const transactionLockDefinition = generateDefinitionSatisfies({
  baseKey: 'transactionLock',
  input: z.object({}),
  getKey: () => 'transactionLock:lock',
  output: z.object({ lockedAt: z.number() }),
});

const coreOrganizationIdToOrganizationIdDefinition =
  generateDefinitionSatisfies({
    baseKey: 'coreOrganizationIdToOrganizationId',
    input: z.object({ coreOrganizationId: z.string() }),
    getKey: (args) =>
      `coreOrganizationIdToOrganizationId:${args.coreOrganizationId}`,
    populateOnMissFn: async (args) => {
      const result = await db.query.organizations.findFirst({
        where: eq(organizations.lettaAgentsId, args.coreOrganizationId),
        columns: {
          id: true,
        },
      });

      if (!result) {
        return null;
      }

      return { expiresAt: 0, data: { organizationId: result.id } };
    },
    output: z.object({ organizationId: z.string() }),
  });

const apiKeysDefinition = generateDefinitionSatisfies({
  baseKey: 'apiKeys',
  input: z.object({ apiKey: z.string(), organizationId: z.string() }),
  getKey: (args) => `apiKeys:${args.apiKey}`,
  output: z.object({
    userId: z.string(),
    organizationId: z.string(),
    coreUserId: z.string(),
  }),
  populateOnMissFn: async (args) => {
    const key = await db.query.lettaAPIKeys.findFirst({
      where: and(
        eq(lettaAPIKeys.apiKey, args.apiKey),
        eq(lettaAPIKeys.organizationId, args.organizationId),
      ),
      columns: {
        organizationId: true,
        coreUserId: true,
        userId: true,
      },
      with: {
        organization: {
          columns: {
            enabledCloudAt: true,
          },
        },
      },
    });

    if (!key) {
      return null;
    }

    if (!key.organization.enabledCloudAt) {
      return null;
    }

    return {
      expiresAt: 0,
      data: {
        userId: key.userId,
        organizationId: key.organizationId,
        coreUserId: key.coreUserId,
      },
    };
  },
});

export const redisDefinitions = {
  userSession: userSessionDefinition,
  organizationRateLimitsPerModel: organizationRateLimitsPerModelDefinition,
  defaultModelRequestPerMinute: defaultModelRequestPerMinuteDefinition,
  defaultModelTokensPerMinute: defaultModelTokenPerMinuteDefinition,
  coreOrganizationIdToOrganizationId:
    coreOrganizationIdToOrganizationIdDefinition,
  rpmWindow: rpmWindowDefinition,
  tpmWindow: tpmWindowDefinition,
  organizationToCoreOrganization: organizationToCoreOrganizationDefinition,
  stepCostSchema: stepCostSchemaDefinition,
  modelNameAndEndpointToIdMap: modelNameAndEndpointToIdMapDefinition,
  transactionLock: transactionLockDefinition,
  apiKeys: apiKeysDefinition,
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

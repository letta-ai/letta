import { z } from 'zod';
import {
  activeAgents,
  clientSideAccessTokens,
  db,
  deployedAgentMetadata,
  inferenceModelsMetadata,
  lettaAPIKeys,
  organizations,
  stepCostSchemaTable,
} from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import {
  accessPolicyVersionOne,
  ModelTiers,
  PaymentCustomerSchema,
  PaymentCustomerSubscriptionSchema,
  stepCostVersionOne,
} from '@letta-cloud/types';
import type { RedisDefinition } from './constants';
import { generateDefinitionSatisfies } from './constants';

export function hasPopulateOnMissFn(
  definition: RedisDefinition<string, any, any>,
): definition is RedisDefinition<string, any, any> {
  return !!definition.populateOnMissFn;
}

const userSessionDefinition = generateDefinitionSatisfies({
  baseKey: 'userSession',
  input: z.object({ sessionId: z.string() }),
  getKey: (args) => `userSession_1:${args.sessionId}`,
  output: z.object({
    email: z.string(),
    name: z.string(),
    imageUrl: z.string(),
    isVerified: z.boolean(),
    activeOrganizationId: z.string(),
    id: z.string(),
    coreUserId: z.string(),
  }),
});

const userIdToUserSessionDefinition = generateDefinitionSatisfies({
  baseKey: 'userIdToUserSession',
  input: z.object({ userId: z.string() }),
  getKey: (args) => `userIdToUserSession:${args.userId}`,
  output: z.object({
    sessionId: z.string(),
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

const forgotPasswordDefinition = generateDefinitionSatisfies({
  baseKey: 'forgotPassword',
  input: z.object({ email: z.string() }),
  getKey: (args) => `forgotPassword:${args.email}`,
  output: z.object({
    email: z.string(),
    code: z.string(),
    canRetryAt: z.number(),
    expiresAt: z.number(),
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

const clientSideApiKeysDefinition = generateDefinitionSatisfies({
  baseKey: 'clientSideApiKeys',
  input: z.object({ token: z.string(), organizationId: z.string() }),
  getKey: (args) => `clientSideApiKeys:${args.token}:${args.organizationId}`,
  output: z.object({
    userId: z.string(),
    organizationId: z.string(),
    coreUserId: z.string(),
    expiresAt: z.number(),
    hostname: z.string(),
    policy: accessPolicyVersionOne,
  }),
  populateOnMissFn: async (args) => {
    const key = await db.query.clientSideAccessTokens.findFirst({
      where: and(
        eq(clientSideAccessTokens.token, args.token),
        eq(clientSideAccessTokens.organizationId, args.organizationId),
      ),
      columns: {
        organizationId: true,
        coreUserId: true,
        requesterUserId: true,
        hostname: true,
        expiresAt: true,
        policy: true,
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

    if (new Date(key.expiresAt).getTime() < Date.now()) {
      return null;
    }

    if (!key.organization.enabledCloudAt) {
      return null;
    }

    return {
      expiresAt: 0,
      data: {
        hostname: key.hostname,
        expiresAt: key.expiresAt,
        userId: key.requesterUserId,
        organizationId: key.organizationId,
        coreUserId: key.coreUserId,
        policy: key.policy,
      },
    };
  },
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

const modelIdToModelTierDefinition = generateDefinitionSatisfies({
  baseKey: 'modelIdToModelTier',
  input: z.object({ modelId: z.string() }),
  getKey: (args) => `modelIdToModelTier:${args.modelId}`,
  output: z.object({
    tier: ModelTiers,
  }),
  populateOnMissFn: async (args) => {
    const model = await db.query.inferenceModelsMetadata.findFirst({
      where: eq(inferenceModelsMetadata.id, args.modelId),
      columns: {
        tier: true,
      },
    });

    if (!model) {
      return null;
    }

    return { expiresAt: 0, data: { tier: model.tier } };
  },
});

const phoneTotpDefinition = generateDefinitionSatisfies({
  baseKey: 'phoneTotp',
  input: z.object({ phone: z.string() }),
  getKey: (args) => `phoneTotp:${args.phone}`,
  output: z.object({
    code: z.string(),
    expiresAt: z.number(),
  }),
});

const emailTotpDefinition = generateDefinitionSatisfies({
  baseKey: 'emailTotp',
  input: z.object({ email: z.string() }),
  getKey: (args) => `emailTotp:${args.email}`,
  output: z.object({
    code: z.string(),
    expiresAt: z.number(),
  }),
});

export const customerSubscriptionDefinition = generateDefinitionSatisfies({
  baseKey: 'customerSubscription',
  input: z.object({ organizationId: z.string() }),
  getKey: (args) => `customerSubscription:${args.organizationId}`,
  output: PaymentCustomerSubscriptionSchema,
});

export const paymentCustomerDefinition = generateDefinitionSatisfies({
  baseKey: 'paymentCustomer',
  input: z.object({ organizationId: z.string() }),
  getKey: (args) => `paymentCustomer:${args.organizationId}`,
  output: PaymentCustomerSchema,
});

export const activeAgentDefinition = generateDefinitionSatisfies({
  baseKey: 'activeAgent',
  input: z.object({ agentId: z.string() }),
  getKey: (args) => `activeAgent:${args.agentId}`,
  output: z.object({ lastActiveAt: z.number(), isBilledAgent: z.boolean() }),
  populateOnMissFn: async (args) => {
    const agent = await db.query.activeAgents.findFirst({
      where: eq(activeAgents.agentId, args.agentId),
    });

    if (!agent) {
      await db.query.activeAgents.findFirst({
        where: eq(activeAgents.agentId, args.agentId),
      });

      return null;
    }

    return {
      expiresAt: 0,
      data: {
        isBilledAgent: agent.isBilledAgent,
        lastActiveAt: new Date(agent.lastActiveAt).getTime() || 0,
      },
    };
  },
});

export const deployedAgentDefinition = generateDefinitionSatisfies({
  baseKey: 'deployedAgent',
  input: z.object({ agentId: z.string() }),
  getKey: (args) => `deployedAgent:${args.agentId}`,
  output: z.object({
    agentId: z.string(),
    isDeployed: z.boolean(),
  }),
  populateOnMissFn: async (args) => {
    const agent = await db.query.deployedAgentMetadata.findFirst({
      where: eq(deployedAgentMetadata.agentId, args.agentId),
      columns: {
        organizationId: true,
        agentId: true,
      },
    });

    if (!agent) {
      return {
        expiresAt: 0,
        data: {
          agentId: args.agentId,
          isDeployed: false,
        },
      };
    }

    return {
      expiresAt: 0,
      data: {
        agentId: agent.agentId,
        isDeployed: true,
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
  forgotPassword: forgotPasswordDefinition,
  rpmWindow: rpmWindowDefinition,
  tpmWindow: tpmWindowDefinition,
  organizationToCoreOrganization: organizationToCoreOrganizationDefinition,
  stepCostSchema: stepCostSchemaDefinition,
  modelNameAndEndpointToIdMap: modelNameAndEndpointToIdMapDefinition,
  transactionLock: transactionLockDefinition,
  apiKeys: apiKeysDefinition,
  clientSideApiKeys: clientSideApiKeysDefinition,
  modelIdToModelTier: modelIdToModelTierDefinition,
  phoneTotp: phoneTotpDefinition,
  userIdToUserSession: userIdToUserSessionDefinition,
  emailTotp: emailTotpDefinition,
  customerSubscription: customerSubscriptionDefinition,
  paymentCustomer: paymentCustomerDefinition,
  activeAgent: activeAgentDefinition,
  deployedAgent: deployedAgentDefinition,
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

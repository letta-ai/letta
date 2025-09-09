import type { Step } from '@letta-cloud/sdk-core';
import { getCreditCostPerModel } from '../getCreditCostPerModel/getCreditCostPerModel';
import { removeCreditsFromOrganization } from '../removeCreditsFromOrganization/removeCreditsFromOrganization';
import {
  createUniqueRedisProperty,
  getRedisData,
} from '@letta-cloud/service-redis';
import {
  getRedisModelTransactions,
  incrementRedisModelTransactions,
} from '../redisModelTransactions/redisModelTransactions';
import { getCustomerSubscription } from '@letta-cloud/service-payments';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import {
  db,
  organizationCreditTransactions,
} from '@letta-cloud/service-database';

interface ProcessStepResponse {
  newCredits?: string;
  transactionId: string;
}

export async function processStep(
  step: Step,
): Promise<ProcessStepResponse | null> {
  if (
    !step.model ||
    !step.model_endpoint ||
    !step.context_window_limit ||
    !step.organization_id
  ) {
    return null;
  }

  if (step.provider_category === 'byok') {
    const org = await getRedisData('coreOrganizationIdToOrganizationId', {
      coreOrganizationId: step.organization_id,
    });

    if (!org) {
      return null;
    }

    const [txn] = await db
      .insert(organizationCreditTransactions)
      .values({
        amount: '0',
        organizationId: org.organizationId,
        stepId: step.id,
        source: 'inference',
        note: `BYOK transaction for model ${step.model}`,
        transactionType: 'subtraction',
      })
      .returning({
        id: organizationCreditTransactions.id,
      }).onConflictDoNothing()

    return {
      transactionId: txn.id,
    };
  }

  const [creditCost, modelData, webOrgId] = await Promise.all([
    getCreditCostPerModel({
      modelName: step.model,
      modelEndpoint: step.model_endpoint,
      contextWindowSize: step.context_window_limit,
    }),
    getRedisData('modelNameAndEndpointToIdMap', {
      modelName: step.model,
      modelEndpoint: step.model_endpoint,
    }),
    getRedisData('coreOrganizationIdToOrganizationId', {
      coreOrganizationId: step.organization_id,
    }),
  ]);

  try {
    if (typeof creditCost !== 'number') {
      console.warn(
        `Model ${step.model} [${step.model_endpoint}] has a cost of 0 credits`,
      );
      return null;
    }

    const transactionLock = await createUniqueRedisProperty(
      'transactionLock',
      {},
      step.id,
      {
        // expires in 15 minutes
        expiresAt: Date.now() + 15 * 60 * 1000,
        data: {
          lockedAt: Date.now(),
        },
      },
    );

    if (!transactionLock) {
      console.warn(`Transaction lock already exists for step ${step.id}`);
      return null;
    }

    let amount = creditCost;

    const modelTier = modelData?.modelId
      ? await getRedisData('modelIdToModelTier', {
          modelId: modelData.modelId,
        })
      : undefined;

    if (
      webOrgId &&
      modelTier &&
      ['free', 'premium'].includes(modelTier?.tier || '')
    ) {
      const subscription = await getCustomerSubscription(
        webOrgId.organizationId,
      );

      const subTier = subscription.tier || 'free';

      const usageLimits = getUsageLimits(subTier);
      const usage = await getRedisModelTransactions(
        modelTier.tier,
        webOrgId.organizationId,
      );

      const limit =
        modelTier.tier === 'free'
          ? usageLimits.freeInferencesPerMonth
          : usageLimits.premiumInferencesPerMonth;

      // if the usage is greater than the limit, we need to deduct credits
      if (usage + 1 <= limit) {
        amount = 0;

        await incrementRedisModelTransactions(
          modelTier.tier,
          webOrgId.organizationId,
          1,
        );
      }
    }

    const response = await removeCreditsFromOrganization({
      amount,
      coreOrganizationId: step.organization_id,
      source: 'inference',
      stepId: step.id,
      modelTier: modelTier?.tier,
      modelId: modelData?.modelId,
      note: `Deducted ${creditCost} credits for model ${step.model}`,
    });

    return response;
  } catch (e) {
    console.error(
      `Failed to deduct credits from organization ${step.organization_id} for model ${step.model}`,
    );
    console.error(e);

    return null;
  }
}

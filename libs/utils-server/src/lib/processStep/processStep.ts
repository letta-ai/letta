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
import type { PaymentCustomerSubscription } from '@letta-cloud/types';
import {
  getRemainingRecurrentCredits,
  incrementRecurrentCreditUsage
} from '../recurringCreditsManager/recurringCreditsManager';
import { eq } from 'drizzle-orm';
import { handleAutoTopUp } from '../handleAutoTopUp/handleAutoTopUp';


async function processStepWithLegacySubscription(step: Step, subscription: PaymentCustomerSubscription) {
  if (
    !step.model ||
    !step.model_endpoint ||
    !step.context_window_limit ||
    !step.organization_id
  ) {
    console.log('Step is missing required fields');
    return null;
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
      trueCost: creditCost,
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

export async function processStepWithSubscription(step: Step, subscription: PaymentCustomerSubscription, organizationId: string) {
  if (
    !step.model ||
    !step.model_endpoint ||
    !step.context_window_limit ||
    !step.organization_id
  ) {
    return null;
  }

  const [creditCost, modelData, remainingRecurrentCredits] = await Promise.all([
    getCreditCostPerModel({
      modelName: step.model,
      modelEndpoint: step.model_endpoint,
      contextWindowSize: step.context_window_limit,
    }),
    getRedisData('modelNameAndEndpointToIdMap', {
      modelName: step.model,
      modelEndpoint: step.model_endpoint,
    }),
    getRemainingRecurrentCredits(organizationId, subscription),
  ]);

  try {
    if (typeof creditCost !== 'number') {
      console.warn(
        `Model ${step.model} [${step.model_endpoint}] has a cost of 0 credits`,
      );
      return null;
    }


    const recurrentCostToDeduct = Math.min(creditCost, remainingRecurrentCredits);
    // if we go over the limit, we need to deduct credits
    const additionalCostToDeduct = creditCost - recurrentCostToDeduct;

    if (recurrentCostToDeduct > 0) {
      await incrementRecurrentCreditUsage(organizationId, subscription, recurrentCostToDeduct);
    }

    return await removeCreditsFromOrganization({
      amount: additionalCostToDeduct,
      coreOrganizationId: step.organization_id,
      source: 'inference',
      trueCost: creditCost,
      stepId: step.id,
      metadata: {
        agentId:  step.agent_id || '',
        runId: step.run_id || '',
      },
      modelTier: 'per-inference',
      modelId: modelData?.modelId,
      note: `Deducted ${recurrentCostToDeduct} monthly and ${additionalCostToDeduct} purchased credits for model ${step.model}`,
    });
  } catch (e) {
    console.error(
      `Failed to deduct credits from organization ${step.organization_id} for model ${step.model}`,
    );
    console.error(e);

    return null;
  }


}

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

  console.log('Start processing step', step.id);

  const transactionLock = await createUniqueRedisProperty(
    'transactionLock',
    {},
    step.id,
    {
      // expires in 15 minutes
      expiresAt: Date.now() + 15 * 60,
      data: {
        lockedAt: Date.now(),
      },
    },
  );

  if (!transactionLock) {
    console.log(`Transaction lock already exists for step ${step.id}`);
    return null;
  }

  const existingTransaction = await db.query.organizationCreditTransactions.findFirst({
    where: eq(organizationCreditTransactions.stepId, step.id)
  })

  if (existingTransaction) {
    console.log('Transaction already exists for step', step.id);
    return {
      transactionId: existingTransaction.id,
      newCredits: undefined
    };
  }

  const org = await getRedisData('coreOrganizationIdToOrganizationId', {
    coreOrganizationId: step.organization_id,
  });

  if (!org) {
    console.error(`No organization found for coreOrganizationId ${step.organization_id}`);
    return null;
  }


  let result: ProcessStepResponse | null = null;

  if (step.provider_category === 'byok') {
    console.log('Processing BYOK step', step.id);

    const [txn] = await db
      .insert(organizationCreditTransactions)
      .values({
        amount: '0',
        trueCost: '0',
        organizationId: org.organizationId,
        stepId: step.id,
        source: 'inference',
        note: `BYOK transaction for model ${step.model}`,
        transactionType: 'subtraction',
      })
      .returning({
        id: organizationCreditTransactions.id,
      }).onConflictDoNothing()

    result = {
      transactionId: txn.id,
    };
  } else {
    const subscription = await getCustomerSubscription(org.organizationId);

    if (subscription.tier === 'pro' || subscription.tier === 'free') {
      console.log('Processing step with subscription', step.id);
      result = await processStepWithSubscription(step, subscription, org.organizationId);
    } else {
      console.log('Processing step with legacy subscription', step.id);
      result = await processStepWithLegacySubscription(step, subscription);
    }
  }

  // Always check for auto top-up after processing step
  try {
    const autoTopUpResult = await handleAutoTopUp({
      organizationId: org.organizationId,
    });

    if (autoTopUpResult.triggered) {
      console.log(
        `[ProcessStep] Auto top-up triggered for organization ${org.organizationId}, added ${autoTopUpResult.creditsAdded} credits`,
      );
    }
  } catch (error) {
    console.error(
      `[ProcessStep] Error checking auto top-up for organization ${org.organizationId}:`,
      error,
    );
    // Don't throw - auto top-up is non-critical
  }

  return result;
}

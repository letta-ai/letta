import { createPayment } from '@letta-cloud/service-payments';
import { getPaymentCustomer } from '@letta-cloud/service-payments';
import { createUniqueRedisProperty, deleteRedisHashField } from '@letta-cloud/service-redis';
import {
  db,
  autoTopUpCreditsConfiguration,
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { getOrganizationCredits } from '../redisOrganizationCredits/redisOrganizationCredits';
import { creditsToDollars } from '@letta-cloud/utils-shared';
import { addCreditsToOrganization } from '../addCreditsToOrganization/addCreditsToOrganization';
import { canAutoTopUpWithinMonthlyLimit } from './handleMaxMonthlySpend/handleMaxMonthlySpend';

const AUTO_TOP_UP_LOCK_EXPIRY_SECONDS = 15 * 60; // 15 minutes

interface HandleAutoTopUpParams {
  organizationId: string;
}

interface HandleAutoTopUpResult {
  triggered: boolean;
  creditsAdded?: number;
  error?: string;
}

/**
 * Handles automatic top-up of credits for an organization.
 * This function checks if the organization's balance is below the configured threshold
 * and automatically purchases credits if needed.
 *
 * @param params - Object containing organizationId
 * @returns Result object indicating if top-up was triggered and details
 */
export async function handleAutoTopUp(
  params: HandleAutoTopUpParams,
): Promise<HandleAutoTopUpResult> {
  const { organizationId } = params;

  try {
    // Get auto top-up configuration
    const config = await db.query.autoTopUpCreditsConfiguration.findFirst({
      where: eq(autoTopUpCreditsConfiguration.organizationId, organizationId),
    });

    // If no config or disabled, return early
    if (!config || !config.enabled) {
      return { triggered: false };
    }

    // Get current organization credits
    const currentCredits = await getOrganizationCredits(organizationId);

    // Check if balance is below threshold
    if (currentCredits >= config.threshold) {
      return { triggered: false };
    }

    console.log(
      `[AutoTopUp] Organization ${organizationId} balance (${currentCredits}) is below threshold (${config.threshold})`,
    );

    // Check if auto top-up would exceed max monthly spend limit
    const monthlySpendCheck = await canAutoTopUpWithinMonthlyLimit({
      organizationId,
      maxMonthlySpend: config.maxMonthlySpend,
      refillAmount: config.refillAmount,
    });

    if (!monthlySpendCheck.canTopUp) {
      console.log(
        `[AutoTopUp] Auto top-up blocked for organization ${organizationId}: ${monthlySpendCheck.reason}`,
      );
      return {
        triggered: false,
        error: monthlySpendCheck.reason || 'Monthly spend limit exceeded',
      };
    }

    console.log(
      `[AutoTopUp] Monthly spend check passed for organization ${organizationId} (spent: ${monthlySpendCheck.currentMonthlySpend}, remaining: ${monthlySpendCheck.remainingBudget})`,
    );

    // Try to acquire Redis lock to prevent duplicate top-ups
    const lockAcquired = await createUniqueRedisProperty(
      'autoTopUpLock',
      {},
      organizationId,
      {
        data: {
          lockedAt: Date.now(),
          organizationId,
        },
        // Lock expires in 15 minutes
        expiresAt: Math.floor(Date.now() / 1000) + AUTO_TOP_UP_LOCK_EXPIRY_SECONDS,
      },
    );

    if (!lockAcquired) {
      console.log(
        `[AutoTopUp] Lock already exists for organization ${organizationId}, skipping`,
      );
      return { triggered: false, error: 'Lock already held' };
    }

    console.log(`[AutoTopUp] Lock acquired for organization ${organizationId}`);

    try {
      // Get payment customer and default payment method
      const customer = await getPaymentCustomer(organizationId);

      if (!customer) {
        throw new Error('Failed to get payment customer');
      }

      if (!customer.defaultPaymentMethod) {
        throw new Error('No default payment method found');
      }

      // Calculate amount in cents (credits * $0.0001)
      const amountInCents = Math.round(creditsToDollars(config.refillAmount) * 100);

      console.log(
        `[AutoTopUp] Charging ${config.refillAmount} credits ($${creditsToDollars(config.refillAmount)}) to organization ${organizationId}`,
      );

      // Create payment
      const payment = await createPayment({
        organizationId,
        amountInCents,
        cardId: customer.defaultPaymentMethod,
      });

      if (!payment || payment.status !== 'succeeded') {
        throw new Error(
          `Payment failed with status: ${payment?.status || 'unknown'}`,
        );
      }

      console.log(
        `[AutoTopUp] Payment succeeded for organization ${organizationId}`,
      );

      // Add credits to organization
      await addCreditsToOrganization({
        organizationId,
        amount: config.refillAmount,
        source: 'auto_top_up',
        note: `Auto top-up: purchased ${config.refillAmount} credits for $${creditsToDollars(config.refillAmount)}`,
      });

      console.log(
        `[AutoTopUp] Successfully added ${config.refillAmount} credits to organization ${organizationId}`,
      );

      // Release lock
      await deleteRedisHashField('autoTopUpLock', {}, organizationId);

      return {
        triggered: true,
        creditsAdded: config.refillAmount,
      };
    } catch (error) {
      console.error(
        `[AutoTopUp] Error processing auto top-up for organization ${organizationId}:`,
        error,
      );

      // Release lock on error
      await deleteRedisHashField('autoTopUpLock', {}, organizationId);

      return {
        triggered: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } catch (error) {
    console.error(
      `[AutoTopUp] Error in handleAutoTopUp for organization ${organizationId}:`,
      error,
    );

    return {
      triggered: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

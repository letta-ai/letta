import {
  db,
  organizationCredits,
  organizationCreditTransactions,
  organizationLowBalanceNotificationLock,
  organizations,
} from '@letta-cloud/service-database';
import { and, eq, sql } from 'drizzle-orm';
import { dollarsToCredits } from '@letta-cloud/utils-shared';
import * as crypto from 'node:crypto';
import { getDefaultContactEmails, sendEmail } from '@letta-cloud/service-email';
import * as Sentry from '@sentry/node';
import {
  decrementRedisOrganizationCredits,
  getOrganizationCredits,
} from '../redisOrganizationCredits/redisOrganizationCredits';
import { getRedisData } from '@letta-cloud/service-redis';
import type { ModelTiersType } from '@letta-cloud/types';

interface RemoveCreditsFromOrganizationOptions {
  stepId?: string;
  amount: number;
  // this is "real" cost in credits, if there were no discounts or free credits applied
  trueCost?: number;
  source: string;
  coreOrganizationId: string;
  modelId?: string;
  modelTier?: ModelTiersType;
  note?: string;
}

interface CheckLowBalanceOptions {
  organizationId: string;
}

const LOW_BALANCE_THRESHOLD = 5;

async function checkLowBalance(options: CheckLowBalanceOptions) {
  try {
    const { organizationId } = options;

    const credits = await getOrganizationCredits(organizationId);

    // check if credits are below $5
    if (!(credits && credits < dollarsToCredits(LOW_BALANCE_THRESHOLD))) {
      return;
    }

    // create lock
    const lockDate = new Date();
    const lockId = crypto.randomBytes(16).toString('hex');

    const [lock] = await db
      .insert(organizationLowBalanceNotificationLock)
      .values({
        lowBalanceNotificationSentAt: lockDate,
        organizationId,
        lockId,
      })
      .returning({
        lockId: organizationLowBalanceNotificationLock.lockId,
      });

    if (!lock) {
      return;
    }

    if (lock.lockId !== lockId) {
      return;
    }

    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: {
        name: true,
      },
    });

    if (!organization) {
      return;
    }

    // send notification
    await sendEmail({
      type: 'lowBalance',
      to: await getDefaultContactEmails({ organizationId }),
      options: {
        locale: 'en',
        organizationName: organization.name,
        threshold: `${LOW_BALANCE_THRESHOLD}.00`,
        topUpUrl: `${process.env.NEXT_PUBLIC_CURRENT_HOST || ''}/settings/organization/usage`,
      },
    });
  } catch (_e) {
    //
  }
}

export async function removeCreditsFromOrganization(
  options: RemoveCreditsFromOrganizationOptions,
) {
  const {
    coreOrganizationId,
    modelId,
    modelTier,
    note,
    source,
    stepId,
    amount,
    trueCost = amount,
  } = options;

  if (isNaN(amount)) {
    throw new Error('Amount must be a number');
  }

  if (amount < 0) {
    throw new Error('Amount must be greater or equal than 0');
  }

  // credits must be whole numbers
  if (!Number.isInteger(amount)) {
    throw new Error('Amount must be a whole number');
  }

  const org = await getRedisData('coreOrganizationIdToOrganizationId', {
    coreOrganizationId,
  });

  if (!org) {
    throw new Error(
      `Could not find organization with id ${coreOrganizationId}`,
    );
  }

  const { organizationId } = org;

  try {
    const [txn] = await db
      .insert(organizationCreditTransactions)
      .values({
        amount: amount.toString(),
        trueCost: trueCost.toString(),
        organizationId,
        stepId,
        source,
        modelId,
        modelTier,
        note,
        transactionType: 'subtraction',
      })
      .returning({
        id: organizationCreditTransactions.id,
      });

    await decrementRedisOrganizationCredits(organizationId, amount);

    const [res] = await db
      .update(organizationCredits)
      .set({
        credits: sql`${organizationCredits.credits} - ${amount}`,
      })
      .where(eq(organizationCredits.organizationId, organizationId))
      .returning({
        credits: organizationCredits.credits,
      });

    if (modelTier === 'per-inference') {
      void checkLowBalance({
        organizationId,
      }).catch((e) => {
        console.error(e);
        Sentry.captureException(e);
      });
    }

    return {
      newCredits: res.credits,
      transactionId: txn.id,
    };
  } catch (e) {
    // check for constraint violation
    if (e instanceof Error && e.message.includes('duplicate key value')) {
      // return current credits and trasaction id  from step id
      const existingTxn =
        await db.query.organizationCreditTransactions.findFirst({
          where: and(
            eq(organizationCreditTransactions.organizationId, organizationId),
            eq(organizationCreditTransactions.stepId, stepId || ''),
          ),
          columns: {
            id: true,
          },
        });

      if (!existingTxn) {
        throw new Error('Could not find existing transaction');
      }

      const orgCredits = await db.query.organizationCredits.findFirst({
        where: eq(organizationCredits.organizationId, organizationId),
        columns: {
          credits: true,
        },
      });

      if (!orgCredits) {
        throw new Error('Could not find organization credits');
      }

      return {
        newCredits: orgCredits.credits,
        transactionId: existingTxn.id,
      };
    }
    throw e;
  }
}

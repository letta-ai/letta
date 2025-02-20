import {
  db,
  organizationCredits,
  organizationCreditTransactions,
  organizationLowBalanceNotificationLock,
  organizations,
} from '@letta-cloud/database';
import { eq, sql } from 'drizzle-orm';
import { dollarsToCredits } from '@letta-cloud/generic-utils';
import * as crypto from 'node:crypto';
import { getDefaultContactEmails, sendEmail } from '@letta-cloud/email';
import * as Sentry from '@sentry/node';
import {
  decrementRedisOrganizationCredits,
  getOrganizationCredits,
} from '../redisOrganizationCredits/redisOrganizationCredits';
import { getRedisData } from '@letta-cloud/redis';

interface RemoveCreditsFromOrganizationOptions {
  stepId?: string;
  amount: number;
  source: string;
  coreOrganizationId: string;
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
        topUpUrl: `${process.env.NEXT_PUBLIC_CURRENT_HOST || ''}/settings/organization/billing`,
      },
    });
  } catch (_e) {
    //
  }
}

export async function removeCreditsFromOrganization(
  options: RemoveCreditsFromOrganizationOptions,
) {
  const { coreOrganizationId, note, source, stepId, amount } = options;

  if (isNaN(amount)) {
    throw new Error('Amount must be a number');
  }

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
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

  const [txn] = await db
    .insert(organizationCreditTransactions)
    .values({
      amount: amount.toString(),
      organizationId,
      stepId,
      source,
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

  void checkLowBalance({
    organizationId,
  }).catch((e) => {
    console.error(e);
    Sentry.captureException(e);
  });

  return {
    newCredits: res.credits,
    transactionId: txn.id,
  };
}

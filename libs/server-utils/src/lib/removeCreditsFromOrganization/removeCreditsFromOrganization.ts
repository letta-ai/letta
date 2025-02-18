import {
  db,
  organizationCredits,
  organizationCreditTransactions,
  organizationLowBalanceNotificationLock,
  organizations,
} from '@letta-cloud/database';
import { eq, sql } from 'drizzle-orm';
import { getRedisData, setRedisData } from '@letta-cloud/redis';
import { dollarsToCredits } from '@letta-cloud/generic-utils';
import * as crypto from 'node:crypto';
import { getDefaultContactEmails, sendEmail } from '@letta-cloud/email';
import * as Sentry from '@sentry/node';

interface RemoveCreditsFromOrganizationOptions {
  coreOrganizationId: string;
  amount: number;
  source: string;
  note?: string;
}

interface CheckLowBalanceOptions {
  coreOrganizationId: string;
  organizationId: string;
}

const LOW_BALANCE_THRESHOLD = 5;

async function checkLowBalance(options: CheckLowBalanceOptions) {
  try {
    const { coreOrganizationId, organizationId } = options;

    const credits = await getRedisData('organizationCredits', {
      coreOrganizationId,
    });

    // check if credits are below $5
    if (
      !(credits && credits.credits < dollarsToCredits(LOW_BALANCE_THRESHOLD))
    ) {
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
  const { coreOrganizationId, note, source, amount } = options;

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

  const currentCredits = await getRedisData('organizationCredits', {
    coreOrganizationId: coreOrganizationId,
  });

  if (!currentCredits) {
    throw new Error(
      `Could not find credits for organization ${coreOrganizationId}`,
    );
  }

  await setRedisData(
    'organizationCredits',
    {
      coreOrganizationId,
    },
    {
      data: {
        credits: currentCredits.credits - amount,
      },
    },
  );

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.lettaAgentsId, coreOrganizationId),
    columns: {
      id: true,
    },
  });

  if (!org) {
    throw new Error(
      `Could not find organization with id ${coreOrganizationId}`,
    );
  }

  const [txn] = await db
    .insert(organizationCreditTransactions)
    .values({
      amount: amount.toString(),
      organizationId: org.id,
      source,
      note,
      transactionType: 'subtraction',
    })
    .returning({
      id: organizationCreditTransactions.id,
    });

  const [res] = await db
    .update(organizationCredits)
    .set({
      credits: sql`${organizationCredits.credits} - ${amount}`,
    })
    .where(eq(organizationCredits.organizationId, org.id))
    .returning({
      credits: organizationCredits.credits,
    });

  void checkLowBalance({
    organizationId: org.id,
    coreOrganizationId,
  }).catch((e) => {
    console.error(e);
    Sentry.captureException(e);
  });

  return {
    newCredits: res.credits,
    transactionId: txn.id,
  };
}

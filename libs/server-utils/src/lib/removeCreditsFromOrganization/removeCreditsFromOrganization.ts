import {
  db,
  organizationCredits,
  organizationCreditTransactions,
  organizations,
} from '@letta-cloud/database';
import { eq, sql } from 'drizzle-orm';
import { getRedisData, setRedisData } from '@letta-cloud/redis';

interface RemoveCreditsFromOrganizationOptions {
  coreOrganizationId: string;
  amount: number;
  source: string;
  note?: string;
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

  await db.insert(organizationCreditTransactions).values({
    amount: amount.toString(),
    organizationId: org.id,
    source,
    note,
    transactionType: 'subtraction',
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

  return res;
}

import {
  db,
  organizationCredits,
  organizationCreditTransactions,
  organizations,
} from '@letta-cloud/database';
import { eq, sql } from 'drizzle-orm';
import { getRedisData, setRedisData } from '@letta-cloud/redis';

interface AddCreditsToOrganizationOptions {
  organizationId: string;
  amount: number;
  source: string;
  note?: string;
}

export async function addCreditsToOrganization(
  options: AddCreditsToOrganizationOptions,
) {
  const { organizationId, note, source, amount } = options;

  if (isNaN(amount)) {
    throw new Error('Amount must be a number');
  }

  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      id: true,
      lettaAgentsId: true,
    },
  });

  if (!org) {
    throw new Error(`Could not find organization with id ${organizationId}`);
  }

  // credits must be whole numbers
  if (!Number.isInteger(amount)) {
    throw new Error('Amount must be a whole number');
  }

  const currentCredits = await getRedisData('organizationCredits', {
    coreOrganizationId: org.lettaAgentsId,
  });

  if (!currentCredits) {
    throw new Error(
      `Could not find credits for organization ${org.lettaAgentsId}`,
    );
  }

  await db.insert(organizationCreditTransactions).values({
    amount: amount.toString(),
    source,
    organizationId,
    note,
    transactionType: 'addition',
  });

  await setRedisData(
    'organizationCredits',
    {
      coreOrganizationId: org.lettaAgentsId,
    },
    {
      data: {
        credits: currentCredits.credits + amount,
      },
    },
  );

  const [res] = await db
    .update(organizationCredits)
    .set({
      credits: sql`${organizationCredits.credits} + ${amount}`,
    })
    .where(eq(organizationCredits.organizationId, organizationId))
    .returning({
      credits: organizationCredits.credits,
    });

  return res;
}

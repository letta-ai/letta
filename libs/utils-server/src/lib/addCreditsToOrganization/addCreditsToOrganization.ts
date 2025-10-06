import {
  db,
  organizationCredits,
  organizationCreditTransactions,
  organizations,
} from '@letta-cloud/service-database';
import { eq, sql } from 'drizzle-orm';
import { incrementRedisOrganizationCredits } from '../redisOrganizationCredits/redisOrganizationCredits';
import type { OrganizationTransactionMetadata } from '@letta-cloud/types';

interface AddCreditsToOrganizationOptions {
  organizationId: string;
  amount: number;
  source: string;
  note?: string;
  metadata?: OrganizationTransactionMetadata
}

export async function addCreditsToOrganization(
  options: AddCreditsToOrganizationOptions,
) {
  const { organizationId, note, metadata, source, amount } = options;

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

  await db.insert(organizationCreditTransactions).values({
    amount: amount.toString(),
    source,
    organizationId,
    note,
    metadata,
    trueCost: amount.toString(),
    transactionType: 'addition',
  });

  await incrementRedisOrganizationCredits(org.id, amount);

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

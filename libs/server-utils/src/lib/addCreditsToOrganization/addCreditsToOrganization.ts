import {
  db,
  organizationCredits,
  organizationCreditTransactions,
} from '@letta-cloud/database';
import { eq, sql } from 'drizzle-orm';

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

  // credits must be whole numbers
  if (!Number.isInteger(amount)) {
    throw new Error('Amount must be a whole number');
  }

  await db.insert(organizationCreditTransactions).values({
    amount: amount.toString(),
    source,
    organizationId,
    note,
    transactionType: 'addition',
  });

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

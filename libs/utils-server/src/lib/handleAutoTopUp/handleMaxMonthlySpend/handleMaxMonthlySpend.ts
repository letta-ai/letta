import { db, organizationCreditTransactions } from '@letta-cloud/service-database';
import { and, eq, sql } from 'drizzle-orm';

interface CanAutoTopUpParams {
  organizationId: string;
  maxMonthlySpend: number | null;
  refillAmount: number;
}

interface CanAutoTopUpResult {
  canTopUp: boolean;
  currentMonthlySpend: number;
  remainingBudget: number;
  reason?: string;
}

/**
 * Checks if an organization can perform another auto top-up based on their max monthly spend limit.
 *
 * This function:
 * 1. Uses SQL to sum all auto_top_up transactions for the current calendar month
 * 2. Determines if adding another refill would exceed the max monthly spend limit
 *
 * @param params - Object containing organizationId, maxMonthlySpend, and refillAmount
 * @returns Result object with canTopUp boolean, current spend, and remaining budget
 */
export async function canAutoTopUpWithinMonthlyLimit(
  params: CanAutoTopUpParams,
): Promise<CanAutoTopUpResult> {
  const { organizationId, maxMonthlySpend, refillAmount } = params;

  // If no max monthly spend is set, always allow top-up
  if (maxMonthlySpend === null || maxMonthlySpend === undefined) {
    return {
      canTopUp: true,
      currentMonthlySpend: 0,
      remainingBudget: Infinity,
    };
  }

  try {
    console.log(
      `[MaxMonthlySpend] Checking auto top-up spend for organization ${organizationId} for current month`,
    );

    // Query sum of auto_top_up transactions for the current month using SQL
    // Uses date_trunc to get the start of current month in UTC
    const result = await db
      .select({
        totalSpend: sql<string>`COALESCE(SUM(${organizationCreditTransactions.amount}::numeric), 0)`,
      })
      .from(organizationCreditTransactions)
      .where(
        and(
          eq(organizationCreditTransactions.organizationId, organizationId),
          eq(organizationCreditTransactions.source, 'auto_top_up'),
          eq(organizationCreditTransactions.transactionType, 'addition'),
          // Filter for transactions in the current month using date_trunc
          sql`date_trunc('month', ${organizationCreditTransactions.createdAt}) = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`,
        ),
      );

    // Parse the sum result (returns as string from numeric type)
    const currentMonthlySpend = parseFloat(result[0]?.totalSpend || '0');

    console.log(
      `[MaxMonthlySpend] Organization ${organizationId} has spent ${currentMonthlySpend} credits via auto top-up this month`,
    );

    // Calculate what the total would be after this top-up
    const potentialTotalSpend = currentMonthlySpend + refillAmount;
    const remainingBudget = maxMonthlySpend - currentMonthlySpend;

    // Check if adding another refill would exceed the limit
    if (potentialTotalSpend > maxMonthlySpend) {
      console.log(
        `[MaxMonthlySpend] Auto top-up blocked: would spend ${potentialTotalSpend} credits, exceeding limit of ${maxMonthlySpend}`,
      );
      return {
        canTopUp: false,
        currentMonthlySpend,
        remainingBudget: Math.max(0, remainingBudget),
        reason: `Adding ${refillAmount} credits would exceed monthly limit of ${maxMonthlySpend} credits (current: ${currentMonthlySpend})`,
      };
    }

    console.log(
      `[MaxMonthlySpend] Auto top-up allowed: ${potentialTotalSpend} credits would be within limit of ${maxMonthlySpend}`,
    );

    return {
      canTopUp: true,
      currentMonthlySpend,
      remainingBudget,
    };
  } catch (error) {
    console.error(
      `[MaxMonthlySpend] Error checking monthly spend limit for organization ${organizationId}:`,
      error,
    );

    // On error, fail open (allow the top-up) to avoid blocking legitimate operations
    // The error will be logged for investigation
    return {
      canTopUp: true,
      currentMonthlySpend: 0,
      remainingBudget: maxMonthlySpend,
      reason: 'Error checking limit, allowing top-up',
    };
  }
}

import { db, clientSideAccessTokens } from '@letta-cloud/service-database';
import { lt } from 'drizzle-orm';
import { UsersService } from '@letta-cloud/sdk-core';
import type { DeleteExpiredTokensAndUsersResult } from '../../types';
import { subDays } from 'date-fns';

export async function deleteExpiredTokensAndUsers(): Promise<DeleteExpiredTokensAndUsersResult> {
  console.log('[Cleanup] Cleaning up expired client-side access tokens.');

  // Find all expired tokens that are older than a week
  // this is a cleanup operation, we want to still store expired tokens for one week before deleting them
  // to allow for any potential recovery or auditing
  const now = subDays(new Date(), 7);
  const expiredTokens = await db
    .select()
    .from(clientSideAccessTokens)
    .where(lt(clientSideAccessTokens.expiresAt, now));

  if (expiredTokens.length === 0) {
    console.log('[Cleanup] No expired tokens found.');
    return {
      expiredTokens: 0,
      deletedTokens: 0,
      deletedUsers: 0,
      failedUserIds: [],
    };
  }

  const coreUserIds = Array.from(
    new Set(expiredTokens.map((t) => t.coreUserId)),
  );

  // Delete tokens
  const deletedTokens = await db
    .delete(clientSideAccessTokens)
    .where(lt(clientSideAccessTokens.expiresAt, now));

  // Delete associated API users
  let successfulUserDeletes = 0;
  const failedUserIds: string[] = [];
  await Promise.all(
    coreUserIds.map(async (userId) => {
      try {
        // TODO: add a bulk endpoint deleteUsers?
        await UsersService.deleteUser({ userId });
        successfulUserDeletes++;
      } catch (err) {
        failedUserIds.push(userId);
        console.error(`[Cleanup] Failed to delete API user ${userId}:`, err);
      }
    }),
  );

  return {
    expiredTokens: expiredTokens.length,
    deletedTokens: deletedTokens.count,
    deletedUsers: successfulUserDeletes,
    failedUserIds,
  };
}

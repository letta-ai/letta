import { proxyActivities } from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { DeleteExpiredTokensAndUsersResult } from '../../types';

const { deleteExpiredTokensAndUsers } = proxyActivities<typeof activities>({
  retry: {
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
    maximumAttempts: 5,
  },
  startToCloseTimeout: '1 hour',
});

export async function cleanupClientSideAccessTokens(): Promise<DeleteExpiredTokensAndUsersResult> {
  return await deleteExpiredTokensAndUsers();
}

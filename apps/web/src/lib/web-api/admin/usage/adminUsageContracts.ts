import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

/* Get Usage Leaderboard */
export const UsageLeaderboardSchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  usage: z.number(),
});

export type UsageLeaderboardType = z.infer<typeof UsageLeaderboardSchema>;

const UsageLeaderboardResponse = z.object({
  leaderboard: z.array(UsageLeaderboardSchema),
  hasNextPage: z.boolean(),
});

const UsageLeaderBoardQueryParams = z.object({
  offset: z.number().optional(),
  limit: z.number().optional(),
  startDate: z.number().optional(),
  endDate: z.number().optional(),
});

const getUsageLeaderboardContract = c.query({
  method: 'GET',
  path: '/admin/usage/leaderboard',
  query: UsageLeaderBoardQueryParams,
  responses: {
    200: UsageLeaderboardResponse,
  },
});

export const adminUsageContracts = {
  getUsageLeaderboard: getUsageLeaderboardContract,
};

export const adminUsageQueryKeys = {
  getUsageLeaderboard: ['getUsageLeaderboard'],
  getUsageLeaderboardWithSearch: (
    search: z.infer<typeof UsageLeaderBoardQueryParams>
  ) => [...adminUsageQueryKeys.getUsageLeaderboard, search],
};

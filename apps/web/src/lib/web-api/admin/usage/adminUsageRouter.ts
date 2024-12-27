import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { db, inferenceTransactions, organizations } from '@letta-web/database';
import { and, gte, inArray, lt, sql } from 'drizzle-orm';

type GetUsageLeaderboardResponse = ServerInferResponses<
  typeof contracts.admin.usage.getUsageLeaderboard
>;
type GetUsageLeaderboardRequest = ServerInferRequest<
  typeof contracts.admin.usage.getUsageLeaderboard
>;

async function getUsageLeaderboard(
  req: GetUsageLeaderboardRequest
): Promise<GetUsageLeaderboardResponse> {
  const {
    offset = 0,
    limit = 10,
    // 30 days ago
    startDate = new Date(
      new Date().getTime() - 30 * 24 * 60 * 60 * 1000
    ).getTime(),
    endDate = new Date().getTime(),
  } = req.query;

  const usageAggregation = await db
    .select({
      organizationId: inferenceTransactions.organizationId,
      count: sql<number>`cast(count(${inferenceTransactions.id}) as int)`,
    })
    .from(inferenceTransactions)
    .offset(offset)
    .limit(limit + 1)
    .where(
      and(
        gte(inferenceTransactions.startedAt, new Date(startDate)),
        lt(inferenceTransactions.startedAt, new Date(endDate))
      )
    )
    .groupBy(inferenceTransactions.organizationId);

  const croppedList = usageAggregation.slice(0, limit);

  const organizationNames = await db.query.organizations.findMany({
    where: inArray(
      organizations.id,
      croppedList.map((usage) => usage.organizationId)
    ),
  });

  const organizationNameMap = organizationNames.reduce((acc, organization) => {
    acc[organization.id] = organization.name;
    return acc;
  }, {} as Record<string, string>);

  const leaderboard = croppedList.map((usage) => ({
    organizationId: usage.organizationId,
    name:
      organizationNameMap[usage.organizationId] ||
      `Unnamed Organization (${usage.organizationId})`,
    usage: usage.count,
  }));

  return {
    status: 200,
    body: {
      leaderboard,
      hasNextPage: usageAggregation.length > limit,
    },
  };
}

export const adminUsageRouter = {
  getUsageLeaderboard,
};

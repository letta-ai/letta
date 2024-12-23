import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { db, inferenceTransactions } from '@letta-web/database';
import { and, eq, gte, lt } from 'drizzle-orm';
import type { GetUsageByModelItem } from '$web/web-api/usage/usageContract';
import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';

interface GetUsageByModelSummaryAndOrganizationIdOptions {
  organizationId: string;
  startDate: number;
  endDate: number;
}

export async function getUsageByModelSummaryAndOrganizationId(
  options: GetUsageByModelSummaryAndOrganizationIdOptions
): Promise<GetUsageByModelItem[]> {
  const { organizationId, startDate, endDate } = options;

  const [response, models] = await Promise.all([
    db.query.inferenceTransactions.findMany({
      where: and(
        eq(inferenceTransactions.organizationId, organizationId),
        gte(inferenceTransactions.startedAt, new Date(startDate)),
        lt(inferenceTransactions.startedAt, new Date(endDate))
      ),
    }),
    db.query.inferenceModelsMetadata.findMany({
      limit: 250,
    }),
  ]);

  const modelNameMap = models.reduce((acc, curr) => {
    acc[curr.modelName] = {
      name: curr.name,
      brand: curr.brand,
    };
    return acc;
  }, {} as Record<string, { name: string; brand: string }>);

  const modelUsage = response.reduce((acc, curr) => {
    if (!acc[curr.providerModel]) {
      const { name, brand } = modelNameMap[curr.providerModel] || {
        name: curr.providerModel,
        brand: '',
      };
      acc[curr.providerModel] = {
        modelKey: curr.providerModel,
        brand: brand,
        modelName: name,
        totalTokens: 0,
        totalCost: 0,
        totalRequests: 0,
      };
    }

    let totalTokens = 0;

    try {
      totalTokens = parseInt(curr.totalTokens);

      if (isNaN(totalTokens)) {
        totalTokens = 0;
      }
    } catch (_e) {
      totalTokens = 0;
    }

    acc[curr.providerModel].totalTokens += totalTokens;
    acc[curr.providerModel].totalCost += 0;
    acc[curr.providerModel].totalRequests += 1;
    return acc;
  }, {} as Record<string, GetUsageByModelItem>);

  return Object.values(modelUsage);
}

type GetUsageByModelSummaryRequest = ServerInferRequest<
  typeof contracts.usage.getUsageByModelSummary
>;
type GetUsageByModelSummaryResponse = ServerInferResponses<
  typeof contracts.usage.getUsageByModelSummary
>;

async function getUsageByModelSummary(
  request: GetUsageByModelSummaryRequest
): Promise<GetUsageByModelSummaryResponse> {
  const { startDate, endDate } = request.query;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  return {
    status: 200,
    body: await getUsageByModelSummaryAndOrganizationId({
      organizationId,
      startDate,
      endDate,
    }),
  };
}

export const usageRouter = {
  getUsageByModelSummary,
};

import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { db } from '@letta-cloud/service-database';
import type { GetUsageByModelItem } from '$web/web-api/contracts';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { StepsService } from '@letta-cloud/sdk-core';

interface GetUsageByModelSummaryAndOrganizationIdOptions {
  lettaAgentsId: string;
  startDate: number;
  endDate: number;
}

export async function getUsageByModelSummaryAndOrganizationId(
  options: GetUsageByModelSummaryAndOrganizationIdOptions,
): Promise<GetUsageByModelItem[]> {
  const { startDate, endDate, lettaAgentsId } = options;

  const [response, models] = await Promise.all([
    StepsService.listSteps(
      {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        order: 'desc',
      },
      {
        user_id: lettaAgentsId,
      },
    ),
    db.query.inferenceModelsMetadata.findMany({
      limit: 250,
    }),
  ]);

  const modelNameMap = models.reduce(
    (acc, curr) => {
      acc[curr.modelName] = {
        name: curr.name,
        brand: curr.brand,
      };
      return acc;
    },
    {} as Record<string, { name: string; brand: string }>,
  );

  const modelUsage = response.reduce(
    (acc, curr) => {
      if (!curr.model) {
        return acc;
      }

      if (!acc[curr.model]) {
        const { name, brand } = modelNameMap[curr.model] || {
          name: curr.model,
          brand: '',
        };
        acc[curr.model] = {
          modelKey: curr.model,
          brand: brand,
          modelName: name,
          totalTokens: 0,
          totalCost: 0,
          totalRequests: 0,
        };
      }

      let totalTokens = 0;

      try {
        totalTokens = curr.total_tokens || 0;

        if (isNaN(totalTokens)) {
          totalTokens = 0;
        }
      } catch (_e) {
        totalTokens = 0;
      }

      acc[curr.model].totalTokens += totalTokens;
      acc[curr.model].totalCost += 0;
      acc[curr.model].totalRequests += 1;
      return acc;
    },
    {} as Record<string, GetUsageByModelItem>,
  );

  return Object.values(modelUsage);
}

type GetUsageByModelSummaryRequest = ServerInferRequest<
  typeof contracts.usage.getUsageByModelSummary
>;
type GetUsageByModelSummaryResponse = ServerInferResponses<
  typeof contracts.usage.getUsageByModelSummary
>;

async function getUsageByModelSummary(
  request: GetUsageByModelSummaryRequest,
): Promise<GetUsageByModelSummaryResponse> {
  const { startDate, endDate } = request.query;
  const user = await getUserWithActiveOrganizationIdOrThrow();

  return {
    status: 200,
    body: await getUsageByModelSummaryAndOrganizationId({
      lettaAgentsId: user.lettaAgentsId,
      startDate,
      endDate,
    }),
  };
}

export const usageRouter = {
  getUsageByModelSummary,
};

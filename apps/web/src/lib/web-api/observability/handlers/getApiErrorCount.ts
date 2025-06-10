import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';

const DEFAULT_SPAN_SEARCH = `(SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages' OR
                   SpanName = 'POST /v1/agents/{agent_id}/messages/async')`;

type GetApiErrorCountRequest = ServerInferRequest<
  typeof contracts.observability.getApiErrorCount
>;

type GetApiErrorCountResponse = ServerInferResponses<
  typeof contracts.observability.getApiErrorCount
>;

export async function getApiErrorCount(
  request: GetApiErrorCountRequest,
): Promise<GetApiErrorCountResponse> {
  const client = getClickhouseClient();

  if (!client) {
    return {
      status: 200,
      body: {
        items: [],
      },
    };
  }

  const { projectId, startDate, endDate } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  const result = await client.query({
    query: `
      SELECT toDate(Timestamp) as error_date,
             count() as error_count
      FROM otel_traces
      WHERE (${DEFAULT_SPAN_SEARCH})
        AND SpanAttributes['project.id'] = {projectId: String}
        AND SpanAttributes['organization.id'] = {organizationId: String}
        AND Timestamp >= {startDate: DateTime}
        AND Timestamp <= {endDate: DateTime}
        AND SpanAttributes['StatusCode'] = 'STATUS_CODE_ERROR'
      GROUP BY toDate(Timestamp)
      ORDER BY error_date DESC
    `,
    query_params: {
      startDate: Math.round(new Date(startDate).getTime() / 1000),
      endDate: Math.round(new Date(endDate).getTime() / 1000),
      organizationId: user.activeOrganizationId,
      projectId,
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<
    Array<{
      error_date: string;
      error_count: string;
    }>
  >(result);

  return {
    status: 200,
    body: {
      items: response.map((item) => ({
        date: item.error_date,
        errorCount: parseInt(item.error_count, 10),
      })),
    },
  };
}

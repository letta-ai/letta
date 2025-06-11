import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts, SearchTypesType } from '@letta-cloud/sdk-web';
import {
  getClickhouseClient,
  getClickhouseData,
} from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { RawAgentTraceRecord } from '$web/web-api/observability/handlers/getTracesByProjectId/types';
import { safeTransformToParentSpanResponses } from '$web/web-api/observability/handlers/getTracesByProjectId/safeTransformToParentSpanResponses';

type GetToolErrorMessagesRequest = ServerInferRequest<
  typeof contracts.observability.getTracesByProjectId
>;

type GetToolErrorMessagesResponse = ServerInferResponses<
  typeof contracts.observability.getTracesByProjectId
>;

interface Conditions {
  durationQuery?: string;
  timestampQuery?: string;
  toolErrorQuery?: string;
  agentIdQuery?: string;
}

function conditionBuilder(search: SearchTypesType[]): Conditions {
  if (search.length === 0) {
    return {};
  }

  const conditions: Conditions = {
    durationQuery: '',
    timestampQuery: '',
    toolErrorQuery: '',
    agentIdQuery: '',
  };

  search.forEach((item) => {
    if (item.field === 'duration') {
      if (item.operator === 'gte') {
        conditions.durationQuery += ` AND Duration >= ${item.value} `;
      }
      if (item.operator === 'lte') {
        conditions.durationQuery += ` AND Duration <= ${item.value} `;
      }
    }

    if (item.field === 'timestamp') {
      if (item.operator === 'gte') {
        conditions.timestampQuery += ` AND Timestamp >= toDateTime('${item.value}') `;
      }
      if (item.operator === 'lte') {
        conditions.timestampQuery += ` AND Timestamp <= toDateTime('${item.value}') `;
      }
    }

    if (item.field === 'statusCode') {
      if (item.value === 'tool_error') {
        conditions.toolErrorQuery += ` AND arrayExists(
          event -> event.Attributes['success'] = 'false',
          Events
        ) `;
      }
    }

    if (item.field === 'functionName') {
      conditions.toolErrorQuery += ` AND arrayExists(
        event -> event.Attributes['function.name'] = '${item.value}',
        Events
      ) `;
    }

    if (item.field === 'agentId') {
      conditions.agentIdQuery += ` AND SpanAttributes['agent.id'] = '${item.value}' `;
    }
  });

  return conditions;
}

export async function getTracesByProjectId(
  request: GetToolErrorMessagesRequest,
): Promise<GetToolErrorMessagesResponse> {
  const { projectId, limit = 10, offset = 0, search } = request.query;

  const user = await getUserWithActiveOrganizationIdOrThrow();
  const client = getClickhouseClient();

  if (!client) {
    return {
      status: 200,
      body: {
        items: [],
        hasNextPage: false,
      },
    };
  }

  const conditions = conditionBuilder(search || []);

  const result = await client.query({
    query: `

      WITH parent_traces AS (
        SELECT
          TraceId,
          StatusMessage,
          StatusCode,
          SpanAttributes,
          Duration
        FROM otel_traces
        WHERE (SpanName = 'POST /v1/agents/{agent_id}/messages/stream' OR
               SpanName = 'POST /v1/agents/{agent_id}/messages' OR
               SpanName = 'POST /v1/agents/{agent_id}/messages/async')
          AND ParentSpanId = ''
            AND SpanAttributes['project.id'] = {projectId: String}
            AND SpanAttributes['organization.id'] = {organizationId: String}
            ${conditions.durationQuery || ''}
            ${conditions.timestampQuery || ''}
            ${conditions.agentIdQuery || ''}
        )
      SELECT
        a.TraceId,
        p.StatusMessage AS parent_status_message,
        p.StatusCode AS parent_status_code,
        p.Duration AS parent_duration,
        p.SpanAttributes AS parent_attributes,
        groupArray(
          tuple(
            a.SpanId,
            a.Timestamp,
            a.SpanAttributes,
            tuple(a.Events.Timestamp, a.Events.Name, a.Events.Attributes)
          )
        ) AS agent_steps,
        count() AS agent_step_count,
        min(a.Timestamp) AS earliest_agent_step,
        max(a.Timestamp) AS latest_agent_step
      FROM otel_traces a
             JOIN parent_traces p ON a.TraceId = p.TraceId
      WHERE a.SpanName = 'agent_step'
      ${conditions.toolErrorQuery || ''}
      GROUP BY a.TraceId, p.StatusMessage, p.Duration, p.StatusCode, p.SpanAttributes
      ORDER BY latest_agent_step DESC
        LIMIT {limit: UInt32}
      OFFSET {offset: UInt32}
    `,
    query_params: {
      organizationId: user.activeOrganizationId,
      projectId,
      limit: limit + 1,
      offset,
    },
    format: 'JSONEachRow',
  });

  const response = await getClickhouseData<RawAgentTraceRecord[]>(result);

  const items = safeTransformToParentSpanResponses(response);

  const totalCount = items.successful.length + items.errors.length;

  return {
    status: 200,
    body: {
      items: items.successful.slice(0, limit),
      hasNextPage: totalCount > limit,
    },
  };
}

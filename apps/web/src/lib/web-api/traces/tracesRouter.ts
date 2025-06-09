import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import { getTracesById } from '@letta-cloud/service-clickhouse';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import { AgentsService } from '@letta-cloud/sdk-core';

type GetTraceRequest = ServerInferRequest<typeof contracts.traces.getTrace>;
type GetTraceResponse = ServerInferResponses<typeof contracts.traces.getTrace>;

async function getTrace(req: GetTraceRequest): Promise<GetTraceResponse> {
  const { traceId } = req.params;

  const user = await getUserWithActiveOrganizationIdOrThrow();

  if (!user) {
    return {
      status: 401,
      body: {
        error: 'Unauthorized',
      },
    };
  }

  const traces = await getTracesById(traceId);

  // find SPAN_KIND_SERVER

  const serverSpans = traces?.find(
    (trace) => trace.SpanKind === 'SPAN_KIND_SERVER',
  );

  if (!serverSpans) {
    return {
      status: 404,
      body: {
        error: 'Trace not found',
      },
    };
  }

  // get agentId from SpanAttributes.http

  const agentId = serverSpans.SpanAttributes['http.agent_id'];

  // get agent to determine if owner is the same as the activeOrganizationId

  try {
    await AgentsService.retrieveAgent(
      {
        agentId,
        includeRelationships: [],
      },
      {
        user_id: user.lettaAgentsId,
      },
    );
  } catch (_) {
    return {
      status: 404,
      body: {
        error: 'Trace not found',
      },
    };
  }

  if (!traces) {
    return {
      status: 404,
      body: {
        error: 'Trace not found',
      },
    };
  }

  return {
    status: 200,
    body: traces,
  };
}

export const tracesRoutes = {
  getTrace,
};

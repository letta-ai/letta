import { EventSource } from 'extended-eventsource';
import { environment } from '@letta-cloud/config-environment-variables';
import axios, { isAxiosError } from 'axios';
import type { MessageCreate } from '@letta-cloud/sdk-core';
import { RESTRICTED_ROUTE_BASE_PATHS } from '@letta-cloud/sdk-core';
import * as Sentry from '@sentry/nextjs';
import { handleMessageRateLimiting } from '@letta-cloud/utils-server';
import { db, organizationPreferences } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';
import { get } from 'lodash-es';

interface RequestOptions {
  pathname: string;
  query: URLSearchParams;
  headers: Headers;
  method: string;
  body: any;
  formData?: FormData;
  signal: AbortSignal;
  lettaAgentsUserId: string;
  source: 'api' | 'web';
  organizationId: string;
}

async function handleEventStreamRequest(options: RequestOptions) {
  const { pathname, method, signal, body, lettaAgentsUserId } = options;
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();

  let closed = false;

  signal.onabort = async () => {
    if (closed) {
      return;
    }

    closed = true;
    await writer.ready;
    await writer.close();
  };

  setImmediate(async () => {
    try {
      const eventsource = new EventSource(
        `${environment.LETTA_AGENTS_ENDPOINT}${pathname}`,
        {
          method: method,
          disableRetry: true,
          keepalive: false,
          headers: {
            user_id: lettaAgentsUserId,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: body ? JSON.stringify(body) : undefined,
        },
      );

      eventsource.onmessage = async (e: MessageEvent) => {
        if (typeof e.data !== 'string') {
          return;
        }

        if (e.data.includes('DONE_GEN')) {
          return;
        }

        if (e.data.includes('DONE_STEP')) {
          return;
        }

        if (closed) {
          return;
        }

        if (e.data === '[DONE]') {
          await writer.write('data: [DONE]\n\n');
          await writer.close();
          closed = true;

          return;
        }

        if (e.eventPhase === eventsource.CLOSED) {
          await writer.close();
          closed = true;
          return;
        }

        await writer.write(`data: ${e.data}\n\n`);
      };
    } catch (e) {
      if (isAxiosError(e)) {
        await writer.write(`data: ${JSON.stringify(e.response?.data)}\n\n`);
      } else {
        await writer.write('data: Unhandled error\n\n');
      }

      closed = true;
      await writer.close();
    }
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

async function handleMultipartFileUpload(options: RequestOptions) {
  const { pathname, method, lettaAgentsUserId, formData } = options;

  const response = await axios({
    method: method,
    url: `${environment.LETTA_AGENTS_ENDPOINT}${pathname}`,
    data: formData,
    headers: {
      user_id: lettaAgentsUserId,
    },
    validateStatus: () => true,
  });

  let data = response.data;

  if (typeof data === 'object') {
    data = JSON.stringify(data);
  }

  return new Response(data, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function isOpenAIChatCompletionRequest(options: RequestOptions) {
  // / openai/v1/chat/completions

  const regex = /\/openai\/v1\/chat\/completions\/?/;

  if (options.method !== 'POST') {
    return false;
  }

  return regex.test(options.pathname);
}

function isCreateMessageRequest(options: RequestOptions) {
  // pathname must conform with /v1/agents/{agent-id}/messages
  const regex = /\/v1\/agents\/[a-zA-Z0-9-]+\/messages\/?/;
  // or /v1/agents/{agent-id}/messages/{message-id}/messages/stream
  const regex2 =
    /\/v1\/agents\/[a-zA-Z0-9-]+\/messages\/[a-zA-Z0-9-]+\/messages\/stream\/?/;
  // or /v1/agents/{agent-id}/messages/{message-id}/messages/async
  const regex3 =
    /\/v1\/agents\/[a-zA-Z0-9-]+\/messages\/[a-zA-Z0-9-]+\/messages\/async\/?/;

  if (options.method !== 'POST') {
    return false;
  }

  return (
    regex.test(options.pathname) ||
    regex2.test(options.pathname) ||
    regex3.test(options.pathname)
  );
}

function isStreamMessageRequest(options: RequestOptions) {
  // pathname must conform with /v1/agents/{agent-id}/messages/{message-id}/messages/stream
  const regex =
    /\/v1\/agents\/[a-zA-Z0-9-]+\/messages\/[a-zA-Z0-9-]+\/messages\/stream\/?/;

  if (options.method !== 'POST') {
    return false;
  }

  return regex.test(options.pathname);
}

interface GetCatchAllProjectId {
  organizationId: string;
}

async function getCatchAllProjectId(args: GetCatchAllProjectId) {
  const { organizationId } = args;

  const orgPrefResponse = await db.query.organizationPreferences.findFirst({
    where: eq(organizationPreferences.organizationId, organizationId),
    columns: {
      defaultProjectId: true,
    },
  });

  if (!orgPrefResponse?.defaultProjectId) {
    Sentry.captureMessage(
      `Organization preferences not found for organization ${organizationId}`,
    );

    throw new Error('Organization preferences not found');
  }

  return orgPrefResponse.defaultProjectId;
}

const identitiesPath = '/v1/identities';

export async function makeRequestToSDK(
  options: RequestOptions,
): Promise<Response> {
  const {
    pathname,
    query,
    headers,
    method,
    body,
    lettaAgentsUserId,
    organizationId,
  } = options;

  if (
    RESTRICTED_ROUTE_BASE_PATHS.some((restrictedPath) =>
      pathname.startsWith(restrictedPath),
    )
  ) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  if (pathname.startsWith(identitiesPath) && method === 'POST') {
    // if project_id is not present in the body, add it
    if (!get(body, 'project_id')) {
      body.project_id = await getCatchAllProjectId({ organizationId });
    }
  }

  if (isOpenAIChatCompletionRequest(options)) {
    const check = await handleMessageRateLimiting({
      organizationId,
      agentId: body.user,
      type: 'inference',
      messages: body.messages,
      lettaAgentsUserId,
    });

    if (check.isRateLimited) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limited',
          reasons: check.reasons,
        }),
        {
          status: (check.reasons || []).includes('not-enough-credits')
            ? 402
            : 429,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  }

  if (
    isCreateMessageRequest(options) &&
    process.env.IS_API_STABILITY_TEST !== 'yes'
  ) {
    const check = await handleMessageRateLimiting({
      organizationId,
      agentId: pathname.split('/')[3],
      type: 'inference',
      messages: body.messages as MessageCreate[],
      lettaAgentsUserId,
    });

    if (check.isRateLimited) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limited',
          reasons: check.reasons,
        }),
        {
          status: (check.reasons || []).includes('not-enough-credits')
            ? 402
            : 429,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  }

  if (
    isStreamMessageRequest(options) ||
    headers.get('Accept') === 'text/event-stream'
  ) {
    return handleEventStreamRequest(options);
  }

  if (headers.get('Content-Type')?.startsWith('multipart/form-data')) {
    return handleMultipartFileUpload(options);
  }

  const queryParam = new URLSearchParams(query);

  try {
    const response = await axios({
      method: method,
      url: `${
        environment.LETTA_AGENTS_ENDPOINT
      }${pathname}?${queryParam.toString()}`,
      data: body,
      headers: {
        user_id: lettaAgentsUserId,
      },
    });

    if (response.status === 204) {
      return new Response(null, {
        status: 204,
      });
    }

    let data = response.data;

    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }

    return new Response(data || JSON.stringify({ success: true }), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    if (isAxiosError(e)) {
      if (e.response?.status && e.response.status >= 500) {
        console.error(e);
        Sentry.captureException(e);
      }

      return new Response(JSON.stringify(e.response?.data), {
        status: e.response?.status || 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    console.error(e);
    Sentry.captureException(e);

    return new Response('Unhandled error', {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

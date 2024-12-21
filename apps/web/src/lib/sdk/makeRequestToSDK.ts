import { EventSource } from 'extended-eventsource';
import { environment } from '@letta-web/environmental-variables';
import axios, { isAxiosError } from 'axios';
import type { LettaResponse } from '@letta-web/letta-agents-api';
import { RESTRICTED_ROUTE_BASE_PATHS } from '@letta-web/letta-agents-api';
import { createInferenceTransaction } from '$web/server/inferenceTransactions/inferenceTransactions';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import type { ToZod } from '@letta-web/helpful-client-utils';

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

const usageDetails: ToZod<LettaResponse['LettaUsageStatistics']> = z
  .object({
    completion_tokens: z.number().optional(),
    prompt_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
    step_count: z.number().optional(),
  })
  .optional();

const usageMessageSchema = z.object({
  usage: usageDetails,
});

interface OnCompletionOptions {
  usageDetails: LettaResponse['LettaUsageStatistics'];
}

async function handleEventStreamRequest(options: RequestOptions) {
  const {
    pathname,
    source,
    method,
    signal,
    body,
    lettaAgentsUserId,
    organizationId,
  } = options;
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();

  const startTime = new Date();
  let referenceId = '';
  let closed = false;

  async function recordUsageDetails(opts: OnCompletionOptions) {
    const { usageDetails } = opts;

    if (isCreateMessageRequest(options)) {
      const agentId = pathname.split('/')[3];

      await createInferenceTransaction({
        agentId,
        startedAt: startTime,
        source,
        endedAt: new Date(),
        organizationId,
        referenceId,
        outputTokens: usageDetails?.completion_tokens || 0,
        inputTokens: usageDetails?.prompt_tokens || 0,
        stepCount: usageDetails?.step_count || 0,
        totalTokens: usageDetails?.total_tokens || 0,
        path: pathname,
      });
    }
  }

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
        }
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

        try {
          const message = JSON.parse(e.data);

          if (usageMessageSchema.safeParse(message).success && message.usage) {
            void recordUsageDetails({ usageDetails: message.usage });
          }

          if (Object.prototype.hasOwnProperty.call(message, 'id')) {
            referenceId = message.id;
          }
        } catch (_e) {
          // do nothing
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

function isCreateMessageRequest(options: RequestOptions) {
  // pathname must conform with /v1/agents/{agent-id}/messages
  const regex = /\/v1\/agents\/[a-zA-Z0-9-]+\/messages\/?/;
  // or /v1/agents/{agent-id}/messages/{message-id}/messages/stream
  const regex2 =
    /\/v1\/agents\/[a-zA-Z0-9-]+\/messages\/[a-zA-Z0-9-]+\/messages\/stream\/?/;

  if (options.method !== 'POST') {
    return false;
  }

  return regex.test(options.pathname) || regex2.test(options.pathname);
}

export async function makeRequestToSDK(
  options: RequestOptions
): Promise<Response> {
  const {
    pathname,
    query,
    headers,
    method,
    body,
    source,
    lettaAgentsUserId,
    organizationId,
  } = options;

  if (
    RESTRICTED_ROUTE_BASE_PATHS.some((restrictedPath) =>
      pathname.startsWith(restrictedPath)
    )
  ) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  if (headers.get('Accept') === 'text/event-stream') {
    return handleEventStreamRequest(options);
  }

  if (headers.get('Content-Type')?.startsWith('multipart/form-data')) {
    return handleMultipartFileUpload(options);
  }

  const queryParam = new URLSearchParams(query);

  const startTime = new Date();

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

    if (isCreateMessageRequest(options)) {
      const agentId = pathname.split('/')[3];
      try {
        if (!data.usage) {
          Sentry.captureException('Usage details not captured', data);
        } else {
          await createInferenceTransaction({
            agentId,
            startedAt: startTime,
            endedAt: new Date(),
            source,
            organizationId,
            referenceId: '',
            outputTokens: data.usage.completion_tokens,
            inputTokens: data.usage.prompt_tokens,
            stepCount: data.usage.step_count,
            totalTokens: data.usage.total_tokens,
            path: pathname,
          });
        }
      } catch (e) {
        Sentry.captureException(e);
      }
    }
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

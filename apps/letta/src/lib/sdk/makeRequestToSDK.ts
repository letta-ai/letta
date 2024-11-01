import { EventSource } from 'extended-eventsource';
import { environment } from '@letta-web/environmental-variables';
import axios, { isAxiosError } from 'axios';
import type { LettaRequest, LettaResponse } from '@letta-web/letta-agents-api';
import { RESTRICTED_ROUTE_BASE_PATHS } from '@letta-web/letta-agents-api';
import { createInferenceTransaction } from '$letta/server/inferenceTransactions/inferenceTransactions';
import * as Sentry from '@sentry/nextjs';

interface RequestOptions {
  pathname: string;
  query: URLSearchParams;
  headers: Headers;
  method: string;
  body: any;
  formData?: FormData;
  signal: AbortSignal;
  lettaAgentsUserId: string;
  organizationId: string;
}

async function handleEventStreamRequest(options: RequestOptions) {
  const { pathname, method, body, signal, lettaAgentsUserId, organizationId } =
    options;
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();

  const startTime = new Date();
  let stepCount = 0;
  let outputTokens = 0;
  let referenceId = '';
  let closed = false;

  async function onCompletion() {
    if (isCreateMessageRequest(options)) {
      const agentId = pathname.split('/')[3];
      const input = body as LettaRequest;

      if (!input.messages) {
        return;
      }

      const inputTokens = input.messages.reduce(
        (acc, message) => acc + (message.text?.split(' ').length || 0),
        0
      );

      await createInferenceTransaction({
        agentId,
        startedAt: startTime,
        endedAt: new Date(),
        organizationId,
        referenceId,
        outputTokens: outputTokens,
        inputTokens: inputTokens,
        stepCount: Math.min(1, stepCount),
        totalTokens: inputTokens + outputTokens,
      });
    }
  }

  // Close if client disconnects
  signal.onabort = async () => {
    if (closed) {
      return;
    }

    await onCompletion();
    void writer.close();
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
        if (closed) {
          return;
        }

        if (typeof e.data === 'string') {
          if (e.data === '[DONE]') {
            await onCompletion();
            await writer.close();
            return;
          }

          if (e.data.includes('DONE_STEP')) {
            stepCount += 1;
          }

          try {
            const message = JSON.parse(e.data) as LettaResponse['Message'];
            referenceId = message?.id || '';
          } catch (_e) {
            console.error(_e);
            // do nothing
          }
        }

        if (e.eventPhase === eventsource.CLOSED) {
          await onCompletion();

          closed = true;
          await writer.close();
          return;
        }

        outputTokens += 1;
        void writer.write(`data: ${e.data}\n\n`);
      };

      eventsource.onerror = async (e) => {
        try {
          console.error('zadu', e);

          await onCompletion();

          if (closed) {
            return;
          }
          await writer.close();
        } catch (_e) {
          // do nothing
        }
      };
    } catch (e) {
      console.error(e);
      if (isAxiosError(e)) {
        await writer.write(`data: ${JSON.stringify(e.response?.data)}\n\n`);
      } else {
        await writer.write('data: Unhandled error\n\n');
      }

      await onCompletion();
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
  const regex = /\/v1\/agents\/[a-zA-Z0-9-]+\/messages\/?$/;

  return regex.exec(options.pathname) && options.method === 'POST';
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
      await createInferenceTransaction({
        agentId,
        startedAt: startTime,
        endedAt: new Date(),
        organizationId,
        referenceId: '',
        outputTokens: data.usage.completion_tokens,
        inputTokens: data.usage.prompt_tokens,
        stepCount: data.usage.step_count,
        totalTokens: data.usage.total_tokens,
      });
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

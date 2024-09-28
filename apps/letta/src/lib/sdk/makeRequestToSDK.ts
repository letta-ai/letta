import type { NextRequest } from 'next/server';
import { EventSource } from 'extended-eventsource';
import { environment } from '@letta-web/environmental-variables';
import axios, { isAxiosError } from 'axios';
import { RESTRICTED_ROUTE_BASE_PATHS } from '@letta-web/letta-agents-api';
import { db, agentTemplates } from '@letta-web/database';
import { eq } from 'drizzle-orm';

export interface HandlerContext {
  params: {
    route: string[];
  };
}

async function handleEventStreamRequest(
  req: NextRequest,
  context: HandlerContext,
  userId: string
) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const path = context.params.route.join('/');

  let closed = false;

  let payload = undefined;

  try {
    payload = await req.json();
  } catch (_err) {
    payload = undefined;
  }

  // Close if client disconnects
  req.signal.onabort = () => {
    if (closed) {
      return;
    }

    void writer.close();
  };

  setImmediate(async () => {
    try {
      const eventsource = new EventSource(
        `${environment.LETTA_AGENTS_ENDPOINT}/${path}`,
        {
          method: req.method,
          disableRetry: true,
          keepalive: false,
          headers: {
            user_id: userId,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: payload ? JSON.stringify(payload) : undefined,
        }
      );

      eventsource.onmessage = (e: MessageEvent) => {
        if (closed) {
          return;
        }

        if (e.eventPhase === eventsource.CLOSED) {
          closed = true;
          void writer.close();
          return;
        }

        void writer.write(`data: ${e.data}\n\n`);
      };

      eventsource.onerror = async () => {
        try {
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
        void writer.write(`data: ${JSON.stringify(e.response?.data)}\n\n`);
        void writer.close();
      } else {
        void writer.write('data: Unhandled error\n\n');
        void writer.close();
      }
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

async function handleMultipartFileUpload(
  req: NextRequest,
  context: HandlerContext,
  userId: string
) {
  // get file from multipart/form-data
  const formData = await req.formData();

  const path = context.params.route.join('/');

  const response = await axios({
    method: req.method,
    url: `${environment.LETTA_AGENTS_ENDPOINT}/${path}`,
    data: formData,
    headers: {
      user_id: userId,
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

export async function makeRequestToSDK(
  req: NextRequest,
  context: HandlerContext,
  userId: string
) {
  const pathname = req.nextUrl.pathname;

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

  if (req.headers.get('Accept') === 'text/event-stream') {
    return handleEventStreamRequest(req, context, userId);
  }

  if (req.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
    return handleMultipartFileUpload(req, context, userId);
  }

  const path = context.params.route.join('/');

  let payload = undefined;

  const queryParameters = req.nextUrl.searchParams.toString();

  try {
    payload = await req.json();
  } catch (_err) {
    // do nothing
  }

  try {
    const response = await axios({
      method: req.method,
      url: `${environment.LETTA_AGENTS_ENDPOINT}/${path}?${queryParameters}`,
      data: payload,
      headers: {
        user_id: userId,
      },
    });

    let data = response.data;

    if (
      response.status === 200 &&
      ['PATCH', 'POST', 'DELETE'].includes(req.method)
    ) {
      // hack to update the updatedAt field if user does anything with agents
      if (
        path.includes('agents') &&
        Object.prototype.hasOwnProperty.call(payload, 'agentId')
      ) {
        void db
          .update(agentTemplates)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(agentTemplates.id, payload.agentId));
      }
    }

    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }

    return new Response(data, {
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

    return new Response('Unhandled error', {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

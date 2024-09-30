import { EventSource } from 'extended-eventsource';
import { environment } from '@letta-web/environmental-variables';
import axios, { isAxiosError } from 'axios';
import { RESTRICTED_ROUTE_BASE_PATHS } from '@letta-web/letta-agents-api';

interface RequestOptions {
  pathname: string;
  query: URLSearchParams;
  headers: Headers;
  method: string;
  body: any;
  formData?: FormData;
  signal: AbortSignal;
  lettaAgentsUserId: string;
}

async function handleEventStreamRequest(options: RequestOptions) {
  const { pathname, method, body, signal, lettaAgentsUserId } = options;
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();

  let closed = false;

  // Close if client disconnects
  signal.onabort = () => {
    if (closed) {
      return;
    }

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

  return data;
}

export async function makeRequestToSDK(
  options: RequestOptions
): Promise<Response> {
  const { pathname, query, headers, method, body, lettaAgentsUserId } = options;

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

    let data = response.data;

    if (typeof data !== 'string') {
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

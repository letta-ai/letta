import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CURRENT_PATH_HEADER } from '$web/constants';
import { isAxiosError } from 'axios';
import * as Sentry from '@sentry/nextjs';

const cloudAPIUrl = process.env.CLOUD_API_ENDPOINT || 'https://api.letta.com';

async function handleStream(req: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();

  //      `${process.env.CLOUD_API_ENDPOINT || 'https://api.letta.com'}${req.nextUrl.pathname}`,

  try {
    const response = await fetch(`${cloudAPIUrl}${req.nextUrl.pathname}`, {
      method: req.method,
      headers: {
        cookie: req.headers.get('cookie') || '',
        'Content-Type': 'application/json',
      },

      body: req.body,
    });

    if (!response.ok) {
      // check if the response is json
      if (!response.headers.get('content-type')?.includes('application/json')) {
        // try to get the error message
        try {
          const errorText = await response.text();

          return NextResponse.json(
            {
              error: 'Error from API',
              details: errorText,
              reasons: [],
            },
            {
              status: response.status,
            },
          );
        } catch (e) {
          Sentry.captureException(e, {
            tags: {
              type: 'fetch-error',
            },
          });

          return NextResponse.json(
            {
              error: 'Error from API',
              details: 'Unknown error',
              reasons: [],
            },
            {
              status: response.status,
            },
          );
        }
      }

      try {
        const data = await response.json();

        // Handle error response
        const errorData: {
          reasons: string[];
        } = { reasons: [] };

        try {
          errorData.reasons = data.reasons;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }

        return NextResponse.json(
          {
            error: 'Error from API',
            details: data,
            reasons: errorData.reasons,
          },
          {
            status: response.status,
          },
        );
      } catch (e) {
        return NextResponse.json(
          {
            error: 'Unknown',
            details: e,
            reasons: [],
          },
          {
            status: response.status,
          },
        );
      }
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder('utf-8');

    function read() {
      if (!reader) {
        return;
      }

      let isWriterClosed = false;

      writer.closed.then(() => {
        isWriterClosed = true;
        if (!reader) {
          return;
        }


        // If the writer is closed, we stop reading
        reader.cancel();
      });

      void reader.read().then(({ done, value }) => {
        if (done) {
          if (!writer) {
            return;
          }

          if (isWriterClosed) {
            return;
          }

          void writer.close();
          return;
        }

        void writer.write(decoder.decode(value));
        read();
      });
    }

    read();
  } catch (error) {
    if (isAxiosError(error)) {
      console.error('Axios error:', error.message);
    } else {
      console.error('Fetch error:', error);
    }
  }

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/v1')) {
    // forward to cloud api
    const url = new URL(request.url);
    url.hostname = new URL(cloudAPIUrl).hostname;
    url.port = new URL(cloudAPIUrl).port;
    url.protocol = new URL(cloudAPIUrl).protocol;

    if (
      request.nextUrl.pathname.includes('/stream') ||
      request.nextUrl.pathname.includes('/mcp/servers/connect')
    ) {
      return handleStream(request);
    }

    return NextResponse.rewrite(url);
  }

  const headers = new Headers(request.headers);

  headers.set(CURRENT_PATH_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

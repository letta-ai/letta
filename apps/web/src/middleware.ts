import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CURRENT_PATH_HEADER } from '$web/constants';
import { isAxiosError } from 'axios';

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
      // Handle error response
      const errorData: {
        reasons: string[];
      } = { reasons: [] };

      try {
        errorData.reasons = (await response.json()).reasons;
      } catch (e) {
        console.error('Error parsing error response:', e);
      }

      return NextResponse.json(
        {
          error: 'Error from API',
          reasons: errorData.reasons,
        },
        {
          status: response.status,
        },
      );
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

      void reader.read().then(({ done, value }) => {
        if (done) {
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

    if (request.nextUrl.pathname.includes('/stream')) {
      return handleStream(request);
    }

    return NextResponse.rewrite(url);
  }

  const headers = new Headers(request.headers);

  headers.set(CURRENT_PATH_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ headers });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

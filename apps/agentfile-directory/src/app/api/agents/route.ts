import { externalWebApi } from '@letta-cloud/sdk-web';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // get query

  const url = new URL(request.url);
  const limit = url.searchParams.get('limit') || '10';
  const offset = url.searchParams.get('offset') || '0';
  const search = url.searchParams.get('search') || '';

  // parse limit and offset to integers
  let parsedLimit = parseInt(limit, 10);
  let parsedOffset = parseInt(offset, 10);

  // validate limit and offset
  if (isNaN(parsedLimit) || parsedLimit < 0) {
    parsedLimit = 10; // default limit
  }

  if (isNaN(parsedOffset) || parsedOffset < 0) {
    parsedOffset = 0; // default offset
  }

  // fetch agents from the database
  const response = await externalWebApi.agentfile.listAgentfiles.query({
    query: {
      limit: parsedLimit,
      offset: parsedOffset,
      search: search,
    },
  });

  if (response.status !== 200) {
    return new Response('Failed to fetch agents', { status: response.status });
  }

  const data = response.body;

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

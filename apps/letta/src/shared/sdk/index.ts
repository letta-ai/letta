import type { NextRequest } from 'next/server';
import axios from 'axios';
import { environment } from '@letta-web/environmental-variables';

export interface HandlerContext {
  params: {
    route: string[];
  };
}

export async function makeRequestToSDK(
  req: NextRequest,
  context: HandlerContext,
  userId: string
) {
  const path = context.params.route.join('/');

  let payload = undefined;

  try {
    payload = await req.json();
  } catch (_err) {
    // do nothing
  }

  const response = await axios({
    method: req.method,
    url: `${environment.LETTA_AGENTS_ENDPOINT}/${path}`,
    data: payload,
    headers: {
      Authorization: 'Bearer password',
      USER_ID: userId,
    },
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

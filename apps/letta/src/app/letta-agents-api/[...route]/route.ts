import { environment } from '@letta-web/environmental-variables';
import axios from 'axios';
import type { NextRequest } from 'next/server';
interface NextContext {
  params: {
    route: string[];
  };
}

export async function handler(req: NextRequest, context: NextContext) {
  const path = context.params.route.join('/');

  const payload = req.body ? await req.json() : undefined;

  const response = await axios({
    method: req.method,
    url: `${environment.LETTA_AGENTS_ENDPOINT}/${path}`,
    data: payload,
    headers: {
      Authorization: 'Bearer password',
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

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};

import { environment } from '@letta-web/environmental-variables';
import axios from 'axios';
interface NextContext {
  params: {
    route: string[];
  };
}

export async function handler(req: Request, context: NextContext) {
  const path = context.params.route.join('/');

  const response = await axios({
    method: req.method,
    url: `${environment.LETTA_AGENTS_ENDPOINT}/${path}`,
    data: req.body,
    headers: {
      Authorization: 'Bearer password',
    },
  });

  return new Response(JSON.stringify(response.data), {
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

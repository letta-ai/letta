import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';
import { environment } from '@letta-cloud/config-environment-variables';
import axios from 'axios';

type GetComposioAppsResponse = ServerInferResponses<
  typeof contracts.composio.getComposioApps
>;

export async function getComposioApps(): Promise<GetComposioAppsResponse> {
  const query = new URLSearchParams();

  query.set('includeLocal', 'false');
  query.set('sortBy', 'alphabet');

  const response = await fetch(
    `https://backend.composio.dev/api/v1/apps?${query.toString()}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': environment.COMPOSIO_API_KEY,
      },
    },
  ).then((res) => res.json());

  return {
    status: 200,
    body: response,
  };
}

type ListComposioActionsResponse = ServerInferResponses<
  typeof contracts.composio.listComposioActions
>;

type ListComposioActionsRequest = ServerInferRequest<
  typeof contracts.composio.listComposioActions
>;

export async function listComposioActions(
  req: ListComposioActionsRequest,
): Promise<ListComposioActionsResponse> {
  const { query = '', app } = req.query;

  if (!app) {
    return {
      status: 400,
      body: {
        error: 'Missing app',
      },
    };
  }

  const queryParameters = new URLSearchParams();

  queryParameters.set('query', query || '');
  // queryParameters.set('limit', limit.toString());
  // queryParameters.set('page', page.toString());
  queryParameters.set('apps', app);

  console.log(
    `https://backend.composio.dev/api/v2/actions/list/all?${queryParameters.toString()}`,
  );

  const response = await axios
    .get(
      `https://backend.composio.dev/api/v2/actions/list/all?${queryParameters.toString()}`,
      {
        headers: {
          'x-api-key': environment.COMPOSIO_API_KEY,
        },
      },
    )
    .then((res) => res.data);

  return {
    status: 200,
    body: response,
  };
}

export const composioRouter = {
  getComposioApps,
  listComposioActions,
};

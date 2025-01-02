import type { ServerInferResponses } from '@ts-rest/core';
import type { sdkContracts } from '@letta-web/letta-agents-api';

type GetHealthResponse = ServerInferResponses<
  typeof sdkContracts.health.getHealth
>;

async function getHealth(): Promise<GetHealthResponse> {
  return {
    body: {
      status: 'ok',
    },
    status: 200,
  };
}

export const healthRouter = {
  getHealth,
};

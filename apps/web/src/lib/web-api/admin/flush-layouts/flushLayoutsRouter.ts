import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { adePreferences, db } from '@letta-cloud/service-database';

type FlushLayoutsResponse = ServerInferResponses<
  typeof contracts.admin.flushLayouts.flushLayouts
>;

async function flushLayouts(): Promise<FlushLayoutsResponse> {
  await db.delete(adePreferences).execute();

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const flushLayoutsRouter = {
  flushLayouts,
};

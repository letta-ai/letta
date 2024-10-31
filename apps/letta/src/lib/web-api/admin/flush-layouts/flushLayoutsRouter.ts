import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { adePreferences, db } from '@letta-web/database';

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

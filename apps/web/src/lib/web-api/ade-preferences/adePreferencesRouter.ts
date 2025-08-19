import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import { adePreferences, db } from '@letta-cloud/service-database';
import { getUserIdOrThrow } from '$web/server/auth';
import { and, eq } from 'drizzle-orm';
import { generateDefaultADELayout } from '$web/utils';

type GetAdePreferencesResponse = ServerInferResponses<
  typeof contracts.adePreferences.getADEPreferences
>;

type GetAdePreferencesRequest = ServerInferRequest<
  typeof contracts.adePreferences.getADEPreferences
>;

async function getADEPreferences(
  request: GetAdePreferencesRequest,
): Promise<GetAdePreferencesResponse> {
  const userId = await getUserIdOrThrow();
  const { agentId } = request.params;

  let preferences = await db.query.adePreferences.findFirst({
    where: and(
      eq(adePreferences.userId, userId),
      eq(adePreferences.agentId, agentId),
    ),
    columns: {
      displayConfig: true,
    },
  });

  if (!preferences) {
    preferences = {
      displayConfig: generateDefaultADELayout().displayConfig,
    };

    await db.insert(adePreferences).values({
      userId,
      displayConfig: preferences.displayConfig,
      agentId,
    });
  }

  return {
    status: 200,
    body: {
      displayConfig: preferences.displayConfig as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Display config structure varies
    },
  };
}

type UpdateAdePreferencesRequest = ServerInferRequest<
  typeof contracts.adePreferences.updateADEPreferences
>;
type UpdateAdePreferencesResponse = ServerInferResponses<
  typeof contracts.adePreferences.updateADEPreferences
>;

async function updateADEPreferences(
  req: UpdateAdePreferencesRequest,
): Promise<UpdateAdePreferencesResponse> {
  const { body, params } = req;
  const { agentId } = params;
  const userId = await getUserIdOrThrow();

  await db
    .update(adePreferences)
    .set({
      displayConfig: body.displayConfig,
    })
    .where(
      and(
        eq(adePreferences.userId, userId),
        eq(adePreferences.agentId, agentId),
      ),
    );

  return {
    status: 200,
    body: req.body,
  };
}

export const adePreferencesRouter = {
  getADEPreferences,
  updateADEPreferences,
};

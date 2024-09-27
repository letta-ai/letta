import type { AdePreferencesData } from '$letta/web-api/ade-preferences/adePreferencesContracts';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import { adePreferences, db } from '@letta-web/database';
import { getUserIdOrThrow } from '$letta/server/auth';
import { eq } from 'drizzle-orm';

function generateDefaultPreferences(): AdePreferencesData {
  return {
    displayConfig: [
      {
        size: 20,
        positions: [
          {
            size: 100,
            positions: [
              {
                id: 'sidebar',
                isActive: true,
                templateId: 'sidebar',
                data: undefined,
              },
            ],
          },
        ],
      },
      {
        size: 40,
        positions: [
          {
            size: 100,
            positions: [
              {
                id: 'simulator',
                isActive: true,
                templateId: 'agent-simulator',
                data: undefined,
              },
            ],
          },
        ],
      },
      {
        size: 40,
        positions: [
          {
            size: 100,
            positions: [
              {
                id: 'archival-memories',
                isActive: false,
                templateId: 'archival-memories',
                data: undefined,
              },
              {
                id: 'welcome',
                isActive: true,
                templateId: 'welcome-panel',
                data: undefined,
              },
            ],
          },
        ],
      },
    ],
  };
}

type GetAdePreferencesResponse = ServerInferResponses<
  typeof contracts.adePreferences.getADEPreferences
>;

export async function getADEPreferences(): Promise<GetAdePreferencesResponse> {
  const userId = await getUserIdOrThrow();

  let preferences = await db.query.adePreferences.findFirst({
    where: eq(adePreferences.userId, userId),
    columns: {
      displayConfig: true,
    },
  });

  if (!preferences) {
    preferences = {
      displayConfig: generateDefaultPreferences().displayConfig,
    };

    await db.insert(adePreferences).values({
      userId,
      displayConfig: preferences.displayConfig,
    });
  }

  return {
    status: 200,
    body: {
      displayConfig:
        preferences.displayConfig as AdePreferencesData['displayConfig'],
    },
  };
}

type UpdateAdePreferencesRequest = ServerInferRequest<
  typeof contracts.adePreferences.updateADEPreferences
>;
type UpdateAdePreferencesResponse = ServerInferResponses<
  typeof contracts.adePreferences.updateADEPreferences
>;

export async function updateADEPreferences(
  req: UpdateAdePreferencesRequest
): Promise<UpdateAdePreferencesResponse> {
  const userId = await getUserIdOrThrow();

  await db
    .update(adePreferences)
    .set({
      displayConfig: req.body.displayConfig,
    })
    .where(eq(adePreferences.userId, userId));

  return {
    status: 200,
    body: req.body,
  };
}

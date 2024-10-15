import type { AdePreferencesData } from '$letta/web-api/ade-preferences/adePreferencesContracts';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import { adePreferences, db } from '@letta-web/database';
import { getUserIdOrThrow } from '$letta/server/auth';
import { and, eq } from 'drizzle-orm';

interface GenerateDefaultPreferencesOptions {
  firstTime?: boolean;
}

export function generateDefaultPreferences(
  options: GenerateDefaultPreferencesOptions = {}
): AdePreferencesData {
  const { firstTime } = options;
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
                id: 'archival-memories',
                isActive: false,
                templateId: 'archival-memories',
                data: undefined,
              },
              {
                id: 'welcome',
                isActive: true,
                templateId: 'welcome-panel',
                data: {
                  firstTime,
                },
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
                id: 'agent-simulator',
                isActive: true,
                templateId: 'agent-simulator',
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

type GetAdePreferencesRequest = ServerInferRequest<
  typeof contracts.adePreferences.getADEPreferences
>;

async function getADEPreferences(
  request: GetAdePreferencesRequest
): Promise<GetAdePreferencesResponse> {
  const userId = await getUserIdOrThrow();
  const { agentId } = request.params;

  let preferences = await db.query.adePreferences.findFirst({
    where: and(
      eq(adePreferences.userId, userId),
      eq(adePreferences.agentId, agentId)
    ),
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
      agentId,
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

async function updateADEPreferences(
  req: UpdateAdePreferencesRequest
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
        eq(adePreferences.agentId, agentId)
      )
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

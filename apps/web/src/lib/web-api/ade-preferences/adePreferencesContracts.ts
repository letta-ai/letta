import { initContract } from '@ts-rest/core';
import type { PanelItemPositionsMatrix } from '@letta-web/component-library';
import type { panelRegistry } from '../../../app/(logged-in)/(ade)/projects/[projectSlug]/agents/[agentId]/panelRegistry';
import { z } from 'zod';

const c = initContract();

export interface AdePreferencesData {
  displayConfig: PanelItemPositionsMatrix<keyof typeof panelRegistry>;
}

const ADEPreferencesSchema = c.type<AdePreferencesData>();

/* Get ADE Preferences */
const getADEPreferencesContract = c.query({
  method: 'GET',
  path: '/ade-preferences/:agentId',
  params: z.object({
    agentId: z.string(),
  }),
  responses: {
    200: ADEPreferencesSchema,
  },
});

/* Update ADE Preferences */
const UpdateADEPreferencesPayloadSchema = c.type<AdePreferencesData>();

const updateADEPreferencesContract = c.mutation({
  method: 'PUT',
  path: '/ade-preferences/:agentId',
  params: z.object({
    agentId: z.string(),
  }),
  body: UpdateADEPreferencesPayloadSchema,
  responses: {
    200: ADEPreferencesSchema,
  },
});

export const adePreferencesContracts = {
  getADEPreferences: getADEPreferencesContract,
  updateADEPreferences: updateADEPreferencesContract,
};

export const adePreferencesQueryClientKeys = {
  getADEPreferences: (agentId: string) => ['adePreferences', agentId],
};

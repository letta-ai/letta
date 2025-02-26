import type { ServerInferResponses } from '@ts-rest/core';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { AccessLevelEnumSchema } from './sharedAgentChatsContracts';

const c = initContract();

export const LaunchLinkSchema = z.object({
  agentTemplateId: z.string(),
  accessLevel: AccessLevelEnumSchema,
  launchLink: z.string(),
});

export type LaunchLinkType = z.infer<typeof LaunchLinkSchema>;

const GetLaunchLinkContract = c.query({
  method: 'GET',
  path: '/launch-link/:agentTemplateId',
  responses: {
    200: LaunchLinkSchema,
    404: z.object({
      message: z.string(),
    }),
  },
});

export const UpdateLaunchLinkSchema = z.object({
  accessLevel: AccessLevelEnumSchema,
});

export type UpdateLaunchLinkType = z.infer<typeof UpdateLaunchLinkSchema>;

const UpdateLaunchLinkContract = c.mutation({
  method: 'PUT',
  path: '/launch-link/:agentTemplateId',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  body: UpdateLaunchLinkSchema,
  responses: {
    200: LaunchLinkSchema,
  },
});

const CreateLaunchLinkContract = c.mutation({
  method: 'POST',
  path: '/launch-link/:agentTemplateId',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  responses: {
    201: LaunchLinkSchema,
  },
  body: z.undefined(),
});

export const launchLinkContracts = {
  getLaunchLink: GetLaunchLinkContract,
  updateLaunchLink: UpdateLaunchLinkContract,
  createLaunchLink: CreateLaunchLinkContract,
};

export const launchLinkQueryKeys = {
  getLaunchLink: (agentTemplateId: string) => ['launch-link', agentTemplateId],
};

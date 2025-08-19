import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { AccessLevelEnumSchema } from './sharedAgentChatsContracts';
import { MemoryVariableVersionOne } from '@letta-cloud/types';

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

const GetLaunchLinkMetadataByLaunchIdContract = c.query({
  method: 'GET',
  path: '/launch-link-metadata/:launchId',
  pathParams: z.object({
    launchId: z.string(),
  }),
  responses: {
    200: z.object({
      organizationName: z.string(),
      memoryVariables: MemoryVariableVersionOne.shape.data,
      agentTemplateId: z.string(),
      accessLevel: AccessLevelEnumSchema,
      launchLink: z.string(),
    }),
  },
});

const createShareChatFromLaunchLinkContract = c.mutation({
  method: 'POST',
  path: '/launch-link/:agentTemplateId/share-chat',
  pathParams: z.object({
    agentTemplateId: z.string(),
  }),
  responses: {
    201: z.object({
      chatId: z.string(),
    }),
  },
  body: z.object({
    memoryVariables: z.record(z.string()),
  }),
});

export const launchLinkContracts = {
  getLaunchLink: GetLaunchLinkContract,
  updateLaunchLink: UpdateLaunchLinkContract,
  createLaunchLink: CreateLaunchLinkContract,
  getLaunchLinkMetadataByLaunchId: GetLaunchLinkMetadataByLaunchIdContract,
  createShareChatFromLaunchLink: createShareChatFromLaunchLinkContract,
};

export const launchLinkQueryKeys = {
  getLaunchLink: (agentTemplateId: string) => ['launch-link', agentTemplateId],
  getLaunchLinkMetadataByLaunchId: (launchId: string) => [
    'launch-link-metadata',
    launchId,
  ],
};

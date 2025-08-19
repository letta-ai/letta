import { initContract } from '@ts-rest/core';
import { z } from 'zod';
const c = initContract();

export const AccessLevelEnumSchema = z.enum([
  'restricted',
  'organization',
  'logged-in',
  'everyone',
]);

export type AccessLevelEnumSchemaType = z.infer<typeof AccessLevelEnumSchema>;

export const GetSharedAgentChatConfigurationSchema = z.object({
  accessLevel: AccessLevelEnumSchema,
  agentId: z.string(),
  isFromLaunchLink: z.boolean(),
  chatId: z.string(),
});

export type GetSharedAgentChatConfigurationSchemaType = z.infer<
  typeof GetSharedAgentChatConfigurationSchema
>;

const AgentChatParams = z.object({
  projectId: z.string(),
  agentId: z.string(),
});

type AgentChatParamsType = z.infer<typeof AgentChatParams>;

const GetSharedAgentChatConfiguration = c.query({
  path: '/projects/:projectId/agents/:agentId/shared-chat/configuration',
  method: 'GET',
  pathParams: AgentChatParams,
  query: z.object({
    upsert: z.boolean().optional(),
  }),
  responses: {
    200: GetSharedAgentChatConfigurationSchema,
  },
});

const UpdateSharedAgentChatConfiguration = z.object({
  accessLevel: AccessLevelEnumSchema,
});

const updateSharedAgentChatConfiguration = c.mutation({
  method: 'PUT',
  path: '/projects/:projectId/agents/:agentId/shared-chat/configuration',
  body: UpdateSharedAgentChatConfiguration,
  pathParams: AgentChatParams,
  responses: {
    200: GetSharedAgentChatConfigurationSchema,
  },
});

const GetSharedAgentFromChatIdResponse = z.object({
  agentId: z.string(),
  agentName: z.string(),
});

const GetSharedAgentFromChatId = c.query({
  method: 'GET',
  path: '/chat/:chatId',
  responses: {
    200: GetSharedAgentFromChatIdResponse,
  },
});

export const sharedAgentChatsContracts = c.router({
  getSharedChatConfiguration: GetSharedAgentChatConfiguration,
  updateSharedChatConfiguration: updateSharedAgentChatConfiguration,
  getSharedAgentFromChatId: GetSharedAgentFromChatId,
});

export const sharedAgentChatQueryClientKeys = {
  getSharedChatConfiguration: (params: AgentChatParamsType) => [
    'projects',
    params.projectId,
    'agents',
    params.agentId,
    'shared-chat',
    'configuration',
  ],
  getSharedAgentFromChatId: (chatId: string) => ['chat', chatId],
};

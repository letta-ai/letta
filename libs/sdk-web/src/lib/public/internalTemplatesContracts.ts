import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { AgentTemplateSchemaResponseSchema } from '@letta-cloud/utils-shared';

const c = initContract();



const GetAgentTemplateByEntityIdParamsSchema = z.object({
  templateId: z.string(),
  entityId: z.string(),
});

const getAgentTemplateByEntityIdContract = c.query({
  method: 'GET',
  path: '/templates/:templateId/agents/:entityId',
  pathParams: GetAgentTemplateByEntityIdParamsSchema,
  responses: {
    200: AgentTemplateSchemaResponseSchema,
    403: z.object({
      error: z.string(),
    }),
    404: z.object({
      error: z.string(),
    }),
  },
});

export const internalTemplatesContracts = c.router({
  getAgentTemplateByEntityId: getAgentTemplateByEntityIdContract,
});

export const templatesQueryClientKeys = {
  getAgentTemplateByEntityId: (templateId: string, entityId: string) =>
    [
      'templates',
      'getAgentTemplateByEntityId',
      { templateId, entityId },
    ] as const,
};

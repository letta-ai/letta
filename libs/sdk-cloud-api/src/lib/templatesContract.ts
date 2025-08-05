import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@anatine/zod-openapi';
import { zodTypes } from '@letta-cloud/sdk-core';

extendZodWithOpenApi(z);

const c = initContract();

const createAgentsFromTemplate = c.mutation({
  method: 'POST',
  path: '/v1/templates/:project/:template_version/agents',
  description: 'Creates an Agent or multiple Agents from a template',
  summary: 'Create agents from a template (Cloud-only)',
  pathParams: z.object({
    project: z.string().openapi({ description: 'The project slug' }),
    template_version: z.string().openapi({
      description:
        'The template version, formatted as {template-name}:{version-number} or {template-name}:latest',
    }),
  }),
  body: z.object({
    tags: z
      .array(
        z.string().regex(/^[a-zA-Z0-9-_ ]*$/, {
          message:
            'Tags can only contain alphanumeric characters, spaces, dashes, and underscores',
        }),
      )
      .optional()
      .openapi({ description: 'The tags to assign to the agent' }),
    agent_name: z
      .string()
      .regex(/^[a-zA-Z0-9-_ ]*$/, {
        message:
          'Agent name can only contain alphanumeric characters, spaces, dashes, and underscores',
      })
      .optional()
      .openapi({
        description:
          'The name of the agent, optional otherwise a random one will be assigned',
      }),
    initial_message_sequence: z
      .object({
        role: z.enum(['user', 'system', 'assistant']),
        content: z.string(),
        name: z.string().nullable().optional(),
        otid: z.string().nullable().optional(),
        sender_id: z.string().nullable().optional(),
        batch_item_id: z.string().nullable().optional(),
        group_id: z.string().nullable().optional(),
      })
      .array()
      .optional()
      .openapi({
        description:
          'Set an initial sequence of messages, if not provided, the agent will start with the default message sequence, if an empty array is provided, the agent will start with no messages',
      }),
    memory_variables: z
      .record(z.string())
      .optional()
      .openapi({ description: 'The memory variables to assign to the agent' }),
    tool_variables: z
      .record(z.string())
      .optional()
      .openapi({ description: 'The tool variables to assign to the agent' }),
    identity_ids: z
      .array(z.string())
      .optional()
      .openapi({ description: 'The identity ids to assign to the agent' }),
  }),
  responses: {
    201: z.object({
      agents: zodTypes.AgentState.array(),
    }),
    402: z.object({
      message: z.string(),
      limit: z.number(),
    }),
  },
});

const PublicTemplateDetails = z.object({
  name: z.string(),
  id: z.string(),
});

const templatesQuery = z.object({
  offset: z.string().or(z.number()).transform(Number).optional(),
  limit: z
    .string()
    .transform(Number)
    .refine((val) => val > 0 && val < 20, {
      message: 'Limit must be between 1 and 20',
    })
    .optional(),
  name: z.string().optional(),
  projectId: z.string().optional(),
});

const listTemplates = c.query({
  method: 'GET',
  path: '/v1/templates',
  description: 'List all templates',
  summary: 'List templates (Cloud-only)',
  query: templatesQuery,
  responses: {
    200: z.object({
      templates: PublicTemplateDetails.array(),
      hasNextPage: z.boolean(),
    }),
  },
});

export const templatesContract = c.router({
  createAgentsFromTemplate,
  listTemplates,
});

export const templateQueryKeys = {
  listTemplates: ['cloud', 'templates', 'list'],
  listTemplatesWithSearch: (query: z.infer<typeof templatesQuery>) => [
    ...templateQueryKeys.listTemplates,
    query,
  ],
};

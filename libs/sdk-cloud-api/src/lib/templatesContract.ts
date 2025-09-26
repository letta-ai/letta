import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { extendZodWithOpenApi } from '@anatine/zod-openapi';
import { zodTypes } from '@letta-cloud/sdk-core';
import { TemplateSnapshotSchema } from '@letta-cloud/utils-shared';
import type { AgentFileSchema } from '@letta-cloud/sdk-core';

extendZodWithOpenApi(z);

const c = initContract();

const createAgentsFromTemplate = c.mutation({
  method: 'POST',
  path: '/v1/templates/:project_id/:template_version/agents',
  description: 'Creates an Agent or multiple Agents from a template',
  summary: 'Create agents from a template (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
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
      group: zodTypes.Group.optional().nullable(),
      deployment_id: z.string().openapi({
        description:
          'The deployment ID of the created agents, group and blocks, can be used to identify from a specific invokation'
      }),
    }),
    402: z.object({
      message: z.string(),
      limit: z.number(),
    }),
  },
});

const PublicTemplateDetails = z.object({
  name: z.string().openapi({ description: 'The exact name of the template' }),
  id: z.string(),
  project_id: z.string(),
  project_slug: z.string(),
  latest_version: z.string().openapi({
    description: 'The latest version of the template',
  }),
  description: z.string().optional(),
  template_deployment_slug: z.string().openapi({
    description:
      'The full name of the template, including version and project slug',
  }),
  updated_at: z.string().openapi({
    description: 'When the template was last updated',
  }),
});

export type PublicTemplateDetailsType = z.infer<typeof PublicTemplateDetails>;

const templatesQuery = z.object({
  offset: z.string().or(z.number()).transform(Number).optional(),
  exact: z
    .string()
    .transform((val) => val === 'true')
    .optional()
    .openapi({ description: 'Whether to search for an exact name match' }),
  limit: z
    .string()
    .transform(Number)
    .refine((val) => val > 0 && val <= 100, {
      message: 'Limit must be between 1 and 100',
    })
    .optional(),
  version: z
    .string()
    .optional()
    .openapi({
      description:
        'Specify the version you want to return, otherwise will return the latest version',
    }),
  template_id: z.string().optional(),
  name: z.string().optional(),
  search: z.string().optional(),
  project_slug: z.string().optional(),
  project_id: z.string().optional(),
  sort_by: z.enum(['updated_at', 'created_at']).optional(),
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
      has_next_page: z.boolean(),
    }),
  },
});

const saveTemplateVersion = c.mutation({
  path: '/v1/templates/:project_id/:template_name',
  method: 'POST',
  description: 'Saves the current version of the template as a new version',
  summary: 'Save template version (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    template_name: z.string().openapi({
      description:
        'The template version, formatted as {template-name}, any version appended will be ignored',
    }),
  }),
  body: z.object({
    preserve_environment_variables_on_migration: z
      .boolean()
      .optional()
      .openapi({
        description:
          'If true, the environment variables will be preserved in the template version when migrating agents',
      }),
    preserve_core_memories_on_migration: z.boolean().optional().openapi({
      description:
        'If true, the core memories will be preserved in the template version when migrating agents',
    }),
    migrate_agents: z.boolean().optional().openapi({
      description:
        'If true, existing agents attached to this template will be migrated to the new template version',
    }),
    message: z.string().optional().openapi({
      description:
        'A message to describe the changes made in this template version',
    }),
  }),
  responses: {
    200: PublicTemplateDetails,
    400: z.object({
      message: z.string(),
    }),
  },
});

const getTemplateSnapshot = c.query({
  path: '/v1/templates/:project_id/:template_version/snapshot',
  method: 'GET',
  description:
    'Get a snapshot of the template version, this will return the template state at a specific version',
  summary: 'Get template snapshot (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    template_version: z.string().openapi({
      description:
        'The template version, formatted as {template-name}:{version-number} or {template-name}:latest',
    }),
  }),
  responses: {
    200: TemplateSnapshotSchema,
  },
});

const forkTemplate = c.mutation({
  path: '/v1/templates/:project_id/:template_version/fork',
  method: 'POST',
  description: 'Forks a template version into a new template',
  summary: 'Fork template (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    template_version: z.string().openapi({
      description:
        'The template version, formatted as {template-name}:{version-number} or {template-name}:latest',
    }),
  }),
  body: z
    .object({
      name: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/, {
          message:
            'Template name can only contain alphanumeric characters, underscores, and dashes',
        })
        .optional()
        .openapi({
          description:
            'Optional custom name for the forked template. If not provided, a random name will be generated.',
        }),
    })
    .optional(),
  responses: {
    200: PublicTemplateDetails,
    400: z.object({
      message: z.string(),
    }),
  },
});

// TypeScript types for createTemplate body
export type CreateTemplateFromAgent = {
  type: 'agent';
  agent_id: string;
  name?: string;
};

export type CreateTemplateFromAgentFile = {
  type: 'agent_file';
  agent_file: AgentFileSchema;
  name?: string;
};

const createTemplate = c.mutation({
  path: '/v1/templates/:project_id',
  method: 'POST',
  description: 'Creates a new template from an existing agent or agent file',
  summary: 'Create template (Cloud-only)',
  body: z
    .discriminatedUnion('type', [
      z
        .object({
          type: z.literal('agent'),
          agent_id: z.string().openapi({
            description:
              'The ID of the agent to use as a template, can be from any project',
          }),
          name: z
            .string()
            .regex(/^[a-zA-Z0-9_-]+$/, {
              message:
                'Template name can only contain alphanumeric characters, underscores, and dashes',
            })
            .optional()
            .openapi({
              description:
                'Optional custom name for the template. If not provided, a random name will be generated.',
            }),
        })
        .openapi({
          summary: 'From Agent',
          description: 'Create a template from an existing agent',
        }),
      z
        .object({
          type: z.literal('agent_file'),
          agent_file: z.record(z.string(), z.any()).openapi({
            description:
              'The agent file to use as a template, this should be a JSON file exported from the platform',
          }),
          name: z
            .string()
            .regex(/^[a-zA-Z0-9_-]+$/, {
              message:
                'Template name can only contain alphanumeric characters, underscores, and dashes',
            })
            .optional()
            .openapi({
              description:
                'Optional custom name for the template. If not provided, a random name will be generated.',
            }),
        })
        .openapi({
          summary: 'From Agent File',
          description: 'Create a template from an uploaded agent file',
        }),
    ])
    .openapi({
      summary: 'Create template',
      description:
        'The type of template to create, currently only agent templates are supported',
    }),
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
  }),
  responses: {
    201: PublicTemplateDetails,
    400: z.object({
      message: z.string(),
    }),
  },
});

const listTemplateVersions = c.query({
  method: 'GET',
  path: '/v1/templates/:project_id/:name/versions',
  description: 'List all versions of a specific template',
  summary: 'List template versions (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    name: z.string().openapi({
      description: 'The template name (without version)',
    }),
  }),
  query: z.object({
    offset: z.string().or(z.number()).transform(Number).optional(),
    limit: z
      .string()
      .transform(Number)
      .refine((val) => val > 0 && val <= 100, {
        message: 'Limit must be between 1 and 100',
      })
      .optional(),
  }),
  responses: {
    200: z.object({
      versions: z.array(
        z.object({
          version: z.string().openapi({ description: 'The version number' }),
          created_at: z
            .string()
            .openapi({ description: 'When the version was created' }),
          message: z
            .string()
            .optional()
            .openapi({ description: 'Version description message' }),
          is_latest: z
            .boolean()
            .openapi({ description: 'Whether this is the latest version' }),
        }),
      ),
      has_next_page: z.boolean(),
      total_count: z.number(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

const deleteTemplate = c.mutation({
  path: '/v1/templates/:project_id/:template_name',
  method: 'DELETE',
  description: 'Deletes all versions of a template with the specified name',
  summary: 'Delete template (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    template_name: z.string().openapi({
      description: 'The template name (without version)',
    }),
  }),
  body: z.object({}).optional(),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

const renameTemplate = c.mutation({
  path: '/v1/templates/:project_id/:template_name/name',
  method: 'PATCH',
  description:
    'Renames all versions of a template with the specified name. Versions are automatically stripped from the current template name if accidentally included.',
  summary: 'Rename template (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    template_name: z.string().openapi({
      description:
        'The current template name (version will be automatically stripped if included)',
    }),
  }),
  body: z.object({
    new_name: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message:
          'Template name can only contain alphanumeric characters, underscores, and dashes',
      })
      .openapi({
        description: 'The new name for the template',
      }),
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    400: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
    409: z.object({
      message: z.string(),
    }),
  },
});

const updateTemplateDescription = c.mutation({
  path: '/v1/templates/:project_id/:template_name/description',
  method: 'PATCH',
  description:
    'Updates the description for all versions of a template with the specified name. Versions are automatically stripped from the current template name if accidentally included.',
  summary: 'Update template description (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    template_name: z.string().openapi({
      description:
        'The template name (version will be automatically stripped if included)',
    }),
  }),
  body: z.object({
    description: z.string().optional().openapi({
      description: 'The new description for the template',
    }),
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
    }),
    400: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
  },
});

const migrateDeployment = c.mutation({
  path: '/v1/templates/:project_id/:template_name/deployments/:deployment_id/migrate',
  method: 'POST',
  description: 'Migrates a deployment to a specific template version',
  summary: 'Migrate deployment to template version (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    template_name: z.string().openapi({
      description: 'The template name (without version)',
    }),
    deployment_id: z.string().openapi({
      description: 'The deployment ID to migrate',
    }),
  }),
  body: z.object({
    version: z.string().openapi({
      description: 'The target template version to migrate to',
    }),
    preserve_tool_variables: z.boolean().optional().openapi({
      description: 'Whether to preserve existing tool variables during migration',
    }),
    preserve_core_memories: z.boolean().optional().openapi({
      description: 'Whether to preserve existing core memories during migration',
    }),
    memory_variables: z.record(z.string()).optional().openapi({
      description: 'Additional memory variables to apply during migration',
    }),
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
      message: z.string().optional(),
    }),
    400: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
    500: z.object({
      message: z.string(),
    }),
  },
});

const setCurrentTemplateFromSnapshot = c.mutation({
  path: '/v1/templates/:project_id/:template_version/snapshot',
  method: 'PUT',
  description: 'Updates the current working version of a template from a snapshot',
  summary: 'Set current template from snapshot (Cloud-only)',
  pathParams: z.object({
    project_id: z.string().openapi({ description: 'The project id' }),
    template_version: z.string().openapi({
      description: 'The template name with :current version (e.g., my-template:current)',
    }),
  }),
  body: z.any().openapi({
    description: 'The template snapshot to set as the current version',
  }),
  responses: {
    200: z.object({
      success: z.boolean(),
      message: z.string().optional(),
    }),
    400: z.object({
      message: z.string(),
    }),
    404: z.object({
      message: z.string(),
    }),
    500: z.object({
      message: z.string(),
    }),
  },
});

export const templatesContract = c.router({
  createAgentsFromTemplate,
  listTemplates,
  saveTemplateVersion,
  getTemplateSnapshot,
  forkTemplate,
  createTemplate,
  deleteTemplate,
  renameTemplate,
  updateTemplateDescription,
  listTemplateVersions,
  migrateDeployment,
  setCurrentTemplateFromSnapshot,
});

export const templateQueryKeys = {
  listTemplates: ['cloud', 'templates', 'list'],
  listTemplatesWithSearch: (query: z.infer<typeof templatesQuery>) => [
    ...templateQueryKeys.listTemplates,
    query,
  ],
  listTemplatesProjectScopedWithSearch: (
    projectId: string,
    query: Omit<z.infer<typeof templatesQuery>, 'projectId'>,
  ) => [...templateQueryKeys.listTemplates, projectId, query],
  infiniteListTemplatesProjectScopedWithSearch: (
    projectId: string,
    query: z.infer<typeof templatesQuery>,
  ) => [...templateQueryKeys.listTemplates, 'infinite', projectId, query],
  getTemplateSnapshot: (project: string, templateVersion: string) => [
    'cloud',
    'templates',
    'snapshot',
    project,
    templateVersion,
  ],
  listTemplateVersions: (projectSlug: string, templateName: string) => [
    'cloud',
    'templates',
    'versions',
    projectSlug,
    templateName,
  ],
  listTemplateVersionsWithQuery: (
    projectSlug: string,
    templateName: string,
    query: { offset?: number; limit?: number },
  ) => ['cloud', 'templates', 'versions', projectSlug, templateName, query],
  infiniteListTemplateVersionsWithQuery: (
    projectSlug: string,
    templateName: string,
    query: { offset?: number; limit?: number },
  ) => [
    'cloud',
    'templates',
    'versions',
    'infinite',
    projectSlug,
    templateName,
    query,
  ],
  renameTemplate: (project: string, templateName: string) => [
    'cloud',
    'templates',
    'name',
    project,
    templateName,
  ],
};

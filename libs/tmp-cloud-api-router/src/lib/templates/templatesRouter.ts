import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import * as Sentry from '@sentry/node';
import { deepEqual } from 'fast-equals';

import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import {
  db,
  deployedAgentMetadata,
  deployedAgentVariables,
  lettaTemplates,
  agentTemplateBlockTemplates,
  projects,
} from '@letta-cloud/service-database';
import type { SDKContext } from '../types';
import {
  getTemplateByName,
  saveTemplate,
  forkTemplate as forkTemplateFn,
  createTemplateFromAgentState,
  createEntitiesFromTemplate,
  createTemplate as createTemplateFromAgentFile,
  CREATE_TEMPLATE_ERRORS,
  GET_NEW_TEMPLATE_NAME_ERRORS,
  CreateEntitiesFromTemplateErrors,
  migrateDeploymentEntities,
  setCurrentTemplateFromSnapshot,
  SET_CURRENT_TEMPLATE_FROM_SNAPSHOT_ERRORS,
  migrateClassicTemplateEntities,
  migrateAllDeploymentsByBaseTemplateId,
  AgentCreationError,
  updateTemplateFromAgentFile,
  UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS,
} from '@letta-cloud/utils-server';
import { getContextDataHack } from '../getContextDataHack/getContextDataHack';
import { and, eq, ilike, count, not, desc, or } from 'drizzle-orm';
import { validateVersionString } from '@letta-cloud/utils-shared';
import { generateTemplateSnapshot } from '@letta-cloud/utils-shared';
import { environment } from '@letta-cloud/config-environment-variables';
import {
  startMigrateTemplateEntities,
  startMigrateDeploymentEntities, startMigrateAllDeploymentsByBaseTemplateId
} from '@letta-cloud/lettuce-client';
import {
  type AgentFileSchema,
  AgentsService,
  BlocksService,
  InternalTemplatesService,
  isAPIError,
} from '@letta-cloud/sdk-core';

type CreateAgentsFromTemplateRequest = ServerInferRequest<
  typeof cloudContracts.templates.createAgentsFromTemplate
>;
type CreateAgentsFromTemplateResponse = ServerInferResponses<
  typeof cloudContracts.templates.createAgentsFromTemplate
>;


function getProjectFromSlugOrId(slugOrId: string, orgId: string) {
  return db.query.projects.findFirst({
    where: and(
      or(eq(projects.id, slugOrId), eq(projects.slug, slugOrId)),
      eq(projects.organizationId, orgId),
    ),
    columns: {
      id: true,
      slug: true,
    },
  });
}

async function createAgentsFromTemplate(
  req: CreateAgentsFromTemplateRequest,
  context: SDKContext,
): Promise<CreateAgentsFromTemplateResponse> {
  const { organizationId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );
  const {
    memory_variables,
    initial_message_sequence,
    identity_ids,
    tool_variables,
    agent_name,
    tags,
  } = req.body;

  const { template_version, project_id } = req.params;

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  const { slug: projectSlug } = project;


  const versionString = `${projectSlug}/${template_version}`;

  if (validateVersionString(versionString) === false) {
    return {
      status: 400,
      body: {
        message:
          'Invalid template version format. Please use the format: project_slug/template_name:version',
      },
    };
  }

  const template = await getTemplateByName({
    versionString,
    organizationId,
    includeAgents: true,
    includeBlocks: true,
    lettaAgentsId: lettaAgentsUserId,
  });


  if (!template) {
    return {
      status: 404,
      body: {
        message:
          'This template does not exist, be sure to follow the following format: project_slug/template_name:version',
      },
    };
  }

  try {
    const response = await createEntitiesFromTemplate({
      projectId: project.id,
      lettaAgentsId: lettaAgentsUserId,
      organizationId,
      template,
      overrides: {
        memoryVariables: memory_variables || {},
        initialMessageSequence: initial_message_sequence || [],
        identityIds: identity_ids || [],
        toolVariables: tool_variables || {},
        name: agent_name,
        tags: tags || [],
      },
    });

    try {
      await db.transaction(async (tx) => {
        // Insert deployed agent metadata for each created agent
        await Promise.all(
          response.agents.map(async (agent) => {
            if (!agent.id || !agent.project_id) {
              throw new Error('Failed to create agent from template');
            }
            await tx.insert(deployedAgentMetadata).values({
              deploymentId: response.deploymentId,
              agentId: agent.id,
              projectId: agent.project_id,
              organizationId,
            });

            await tx.insert(deployedAgentVariables).values({
              deployedAgentId: agent.id,
              deploymentId: response.deploymentId,
              value: memory_variables || {},
              organizationId,
            });
          }),
        );
      });
    } catch (e) {
      Sentry.captureException(e);
      // delete
      await InternalTemplatesService.deleteDeployment(
        {
          deploymentId: response.deploymentId,
        },
        {
          user_id: lettaAgentsUserId,
        },
      );

      return {
        status: 500,
        body: {
          message:
            'Failed to save deployed agent metadata, creation rolled back (agents may be partially created but may be broken)',
        },
      };
    }

    return {
      status: 201,
      body: {
        agents: response.agents,
        group: response.group,
        deployment_id: response.deploymentId,
      },
    };
  } catch (e) {
    if (e instanceof AgentCreationError) {
      return {
        status: 400,
        body: {
          message: e.message,
          details: e.body,
        },
      }
    }

    if (e instanceof Error) {
      const messages = Object.values(CreateEntitiesFromTemplateErrors);
      if (messages.includes(e.message)) {
        return {
          status: 400,
          body: {
            message: e.message,
          },
        };
      }
    }

    Sentry.captureException(e);
    return {
      status: 500,
      body: {
        message: 'Failed to create agents from template',
      },
    };
  }
}

type ListTemplatesRequest = ServerInferRequest<
  typeof cloudContracts.templates.listTemplates
>;

type ListTemplatesResponse = ServerInferResponses<
  typeof cloudContracts.templates.listTemplates
>;

async function listTemplates(
  req: ListTemplatesRequest,
  context: SDKContext,
): Promise<ListTemplatesResponse> {
  const { organizationId } = getContextDataHack(req, context);

  const { query } = req;

  const {
    name,
    limit = 25,
    offset = 0,
    exact,
    search,
    project_id,
    project_slug,
    template_id,
    version,
    sort_by,
  } = query;

  if (project_id && project_slug) {
    return {
      status: 400,
      body: {
        message: 'Please provide either project_id or project_slug, not both.',
      },
    };
  }

  let projectId = project_id;

  if (!projectId && project_slug) {
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.slug, project_slug),
        eq(projects.organizationId, organizationId),
      ),
      columns: {
        id: true,
      },
    });

    if (!project) {
      return {
        status: 404,
        body: {
          message: 'Project not found',
        },
      };
    }

    projectId = project.id;
  }

  const templatesResponse = await db.query.lettaTemplates.findMany({
    where: and(
      eq(lettaTemplates.organizationId, organizationId),
      ...(version && version !== 'latest'
        ? [eq(lettaTemplates.version, version)]
        : []),
      ...(!template_id && (!version || version === 'latest')
        ? [eq(lettaTemplates.latestDeployed, true)]
        : []),
      ...(search ? [ilike(lettaTemplates.name, `%${search}%`)] : []),
      ...(name && !exact ? [ilike(lettaTemplates.name, `%${name}%`)] : []),
      ...(name && exact ? [eq(lettaTemplates.name, name)] : []),
      ...(projectId ? [eq(lettaTemplates.projectId, projectId)] : []),
      ...(template_id ? [eq(lettaTemplates.id, template_id)] : []),
    ),
    with: {
      project: {
        columns: {
          slug: true,
        },
      },
    },
    orderBy: [
      sort_by === 'updated_at'
        ? desc(lettaTemplates.updatedAt)
        : desc(lettaTemplates.createdAt),
    ],
    offset,
    limit: limit + 1,
  });

  return {
    status: 200,
    body: {
      templates: templatesResponse.slice(0, limit).map((template) => {
        return {
          id: template.id,
          name: template.name,
          project_slug: template.project.slug,
          project_id: template.projectId,
          description: template.description || '',
          latest_version: template.version,
          template_deployment_slug: `${template.project.slug}/${template.name}:${template.version}`,
          updated_at: template.updatedAt.toISOString(),
        };
      }),
      has_next_page: templatesResponse.length > limit,
    },
  };
}

type GetTemplateSnapshotRequest = ServerInferRequest<
  typeof cloudContracts.templates.getTemplateSnapshot
>;
type GetTemplateSnapshotResponse = ServerInferResponses<
  typeof cloudContracts.templates.getTemplateSnapshot
>;

async function getTemplateSnapshot(
  req: GetTemplateSnapshotRequest,
  context: SDKContext,
): Promise<GetTemplateSnapshotResponse> {
  const { organizationId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );
  const { template_version, project_id } = req.params;

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  const { slug: projectSlug } = project;
  const versionString = `${projectSlug}/${template_version}`;

  if (validateVersionString(versionString) === false) {
    return {
      status: 400,
      body: {
        message:
          'Invalid template version format. Please use the format: project_slug/template_name:version',
      },
    };
  }

  const template = await getTemplateByName({
    versionString,
    organizationId,
    includeAgents: true,
    includeBlocks: true,
    lettaAgentsId: lettaAgentsUserId,
  });

  if (!template) {
    return {
      status: 404,
      body: {
        message:
          'This template does not exist, be sure to follow the following format: project_slug/template_name:version',
      },
    };
  }

  // Fetch agent-block relationships separately
  const relationships = await db.query.agentTemplateBlockTemplates.findMany({
    where: eq(agentTemplateBlockTemplates.lettaTemplateId, template.id),
  });

  // Create template object with relationships for snapshot generation
  const templateWithRelationships = {
    ...template,
    agentTemplateBlockTemplates: relationships,
  };

  return {
    status: 200,
    body: generateTemplateSnapshot(templateWithRelationships),
  };
}

type SaveTemplateVersionRequest = ServerInferRequest<
  typeof cloudContracts.templates.saveTemplateVersion
>;

type SaveTemplateVersionResponse = ServerInferResponses<
  typeof cloudContracts.templates.saveTemplateVersion
>;

async function saveTemplateVersion(
  req: SaveTemplateVersionRequest,
  context: SDKContext,
): Promise<SaveTemplateVersionResponse> {
  const { organizationId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );
  const { project_id, template_name } = req.params;
  const {
    preserve_environment_variables_on_migration = false,
    migrate_agents,
    preserve_core_memories_on_migration = false,
    message,
  } = req.body;

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // throw an error if template_name contains a version
  if (template_name.split(':').length > 1) {
    return {
      status: 400,
      body: {
        message:
          'Template name should not contain a version. Use the format: project_slug/template_name',
      },
    };
  }

  const newVersion = await saveTemplate({
    projectSlug: project.slug,
    templateName: template_name,
    organizationId,
    lettaAgentsId: lettaAgentsUserId,
    message: message || '',
  });

  const versionString = `${project.slug}/${template_name}:latest`;

  if (validateVersionString(versionString) === false) {
    return {
      status: 400,
      body: {
        message:
          'Invalid template version format. Please use the format: project_slug/template_name',
      },
    };
  }


  if (migrate_agents) {
    if (newVersion.type === 'classic') {
      if (environment.TEMPORAL_LETTUCE_API_HOST) {
        await startMigrateTemplateEntities({
          preserveToolVariables: preserve_environment_variables_on_migration,
          versionString,
          preserveCoreMemories: preserve_core_memories_on_migration,
          organizationId,
          lettaAgentsId: lettaAgentsUserId,
        });
      } else {
        await migrateClassicTemplateEntities({
          preserveToolVariables: preserve_environment_variables_on_migration,
          versionString,
          preserveCoreMemories: preserve_core_memories_on_migration,
          organizationId,
          lettaAgentsId: lettaAgentsUserId,
        });
      }
    } else {

      const baseTemplate = await getTemplateByName({
        lettaAgentsId: lettaAgentsUserId,
        organizationId,
        versionString: `${project.slug}/${template_name}:current`,
      })

      if (!baseTemplate) {
        throw new Error('Base template not found for migration');
      }

      if (environment.TEMPORAL_LETTUCE_API_HOST) {
        await startMigrateAllDeploymentsByBaseTemplateId({
          preserveToolVariables: preserve_environment_variables_on_migration,
          baseTemplateId: baseTemplate.id,
          preserveCoreMemories: preserve_core_memories_on_migration,
          organizationId,
          lettaAgentsId: lettaAgentsUserId,
        })
      } else {
        await migrateAllDeploymentsByBaseTemplateId({
          preserveToolVariables: preserve_environment_variables_on_migration,
          baseTemplateId: baseTemplate.id,
          preserveCoreMemories: preserve_core_memories_on_migration,
          organizationId,
          lettaAgentsUserId: lettaAgentsUserId,
        })
      }
    }


  }

  return {
    status: 200,
    body: {
      id: newVersion.id,
      name: newVersion.name,
      project_slug: project.slug,
      project_id: newVersion.projectId,
      description: newVersion.description || '',
      latest_version: newVersion.version,
      template_deployment_slug: `${project.slug}/${newVersion.name}:${newVersion.version}`,
      updated_at: newVersion.updatedAt.toISOString(),
    },
  };
}

type ForkTemplateRequest = ServerInferRequest<
  typeof cloudContracts.templates.forkTemplate
>;

type ForkTemplateResponse = ServerInferResponses<
  typeof cloudContracts.templates.forkTemplate
>;

async function forkTemplate(
  req: ForkTemplateRequest,
  context: SDKContext,
): Promise<ForkTemplateResponse> {
  const { organizationId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );
  const { template_version, project_id } = req.params;
  const { name } = req.body || {};

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  const { slug: projectSlug } = project;
  const versionString = `${projectSlug}/${template_version}`;

  if (validateVersionString(versionString) === false) {
    return {
      status: 400,
      body: {
        message:
          'Invalid template version format. Please use the format: project_slug/template_name:version',
      },
    };
  }

  const sourceTemplate = await getTemplateByName({
    versionString,
    organizationId,
    lettaAgentsId: lettaAgentsUserId,
  });

  if (!sourceTemplate) {
    return {
      status: 400,
      body: {
        message:
          'This template does not exist, be sure to follow the following format: project_slug/template_name:version',
      },
    };
  }

  try {
    const newTemplate = await forkTemplateFn({
      sourceTemplateId: sourceTemplate.id,
      organizationId,
      lettaAgentsId: lettaAgentsUserId,
      projectSlug: projectSlug,
      name,
    });

    return {
      status: 200,
      body: {
        id: newTemplate.id,
        name: newTemplate.name,
        project_slug: projectSlug,
        project_id: newTemplate.projectId,
        description: newTemplate.description || '',
        latest_version: newTemplate.version,
        template_deployment_slug: `${projectSlug}/${newTemplate.name}:${newTemplate.version}`,
        updated_at: newTemplate.updatedAt.toISOString(),
      },
    };
  } catch (_error) {
    console.log('Error forking template:', _error);
    return {
      status: 400,
      body: {
        message: 'Failed to fork template',
      },
    };
  }
}

type CreateTemplateRequest = ServerInferRequest<
  typeof cloudContracts.templates.createTemplate
>;
type CreateTemplateResponse = ServerInferResponses<
  typeof cloudContracts.templates.createTemplate
>;

async function createTemplate(
  req: CreateTemplateRequest,
  context: SDKContext,
): Promise<CreateTemplateResponse> {
  const { organizationId, lettaAgentsUserId, userId } = getContextDataHack(
    req,
    context,
  );
  const { project_id } = req.params;
  const { name, type } = req.body;

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 400,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Get full project data with organization check
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, project.id),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!projectData) {
    return {
      status: 400,
      body: {
        message: 'Project not found',
      },
    };
  }

  try {
    let lettaTemplate, projectSlug;

    if (type === 'agent') {
      const { agent_id } = req.body;
      // Retrieve the agent to create template from
      const agentState = await AgentsService.retrieveAgent(
        {
          agentId: agent_id,
        },
        {
          user_id: lettaAgentsUserId,
        },
      ).catch((e) => {
        if (isAPIError(e)) {
          if (e.status === 404 || e.status === 400) {
            return null;
          }
        }

        throw e;
      });

      if (!agentState) {
        return {
          status: 400,
          body: {
            message: 'Agent not found',
          },
        };
      }

      // check if agent has any shared memory blocks, disable
      const memoryBlockSiblings = await Promise.all(
        agentState.memory.blocks.map(async (block) => {
          const agentList = await BlocksService.listAgentsForBlock(
            {
              blockId: block.id || '',
            },
            {
              user_id: lettaAgentsUserId,
            },
          );

          return agentList.length > 1;
        }),
      );

      const hasSharedMemoryBlocks = memoryBlockSiblings.some(
        (hasShared) => hasShared === true,
      );

      if (hasSharedMemoryBlocks) {
        return {
          status: 400,
          body: {
            message:
              'Cannot create template from agent with shared memory blocks',
          },
        };
      }

      // Create template from agent state
      const result = await createTemplateFromAgentState({
        projectId: projectData.id,
        organizationId,
        lettaAgentsId: lettaAgentsUserId,
        userId,
        agentState,
        name,
      });
      lettaTemplate = result.lettaTemplate;
      projectSlug = result.projectSlug;
    } else if (type === 'agent_file') {
      const { agent_file: agentFileSchema, update_existing_tools = false } = req.body;

      if (!agentFileSchema) {
        return {
          status: 400,
          body: {
            message: 'Agent file schema is required for type agent_file',
          },
        };
      }

      const result = await createTemplateFromAgentFile({
        projectId: projectData.id,
        organizationId,
        lettaAgentsId: lettaAgentsUserId,
        userId,
        base: agentFileSchema as AgentFileSchema,
        name,
        updateExistingTools: update_existing_tools,
      });
      lettaTemplate = result.lettaTemplate;
      projectSlug = result.projectSlug;
    } else {
      return {
        status: 400,
        body: {
          message: 'Invalid template type',
        },
      };
    }
    return {
      status: 201,
      body: {
        id: lettaTemplate.id,
        name: lettaTemplate.name,
        project_id: lettaTemplate.projectId,
        project_slug: projectSlug,
        latest_version: lettaTemplate.version,
        description: lettaTemplate.description || '',
        template_deployment_slug: `${projectSlug}/${lettaTemplate.name}:${lettaTemplate.version}`,
        updated_at: lettaTemplate.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      // Get all createTemplate error messages that should be exposed to users
      const knownErrors = Object.values({
        ...CREATE_TEMPLATE_ERRORS,
        ...GET_NEW_TEMPLATE_NAME_ERRORS,
      });

      // Check if the error message matches any known error
      const isKnownError = knownErrors.some((knownError) =>
        error.message.includes(knownError),
      );

      if (isKnownError) {
        return {
          status: 400,
          body: {
            message: error.message,
          },
        };
      }
    }

    // This catch block should only handle unexpected errors that weren't caught above
    console.error('Unexpected error in createTemplate:', error);
    return {
      status: 500,
      body: {
        message: 'An unexpected error occurred. Please try again.',
      },
    };
  }
}

type DeleteTemplateRequest = ServerInferRequest<
  typeof cloudContracts.templates.deleteTemplate
>;
type DeleteTemplateResponse = ServerInferResponses<
  typeof cloudContracts.templates.deleteTemplate
>;

async function deleteTemplate(
  req: DeleteTemplateRequest,
  context: SDKContext,
): Promise<DeleteTemplateResponse> {
  const { organizationId } = getContextDataHack(req, context);
  const { project_id, template_name } = req.params;

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Get full project data with organization check
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, project.id),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!projectData) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  try {
    // Find all templates with the given name in the project
    const templatesToDelete = await db.query.lettaTemplates.findMany({
      where: and(
        eq(lettaTemplates.organizationId, organizationId),
        eq(lettaTemplates.projectId, projectData.id),
        eq(lettaTemplates.name, template_name),
      ),
    });

    if (templatesToDelete.length === 0) {
      return {
        status: 404,
        body: {
          message: `Template '${template_name}' not found in project '${project.slug}'`,
        },
      };
    }

    // Delete all template versions with this name
    await db
      .delete(lettaTemplates)
      .where(
        and(
          eq(lettaTemplates.organizationId, organizationId),
          eq(lettaTemplates.projectId, projectData.id),
          eq(lettaTemplates.name, template_name),
        ),
      )
      .execute();

    return {
      status: 200,
      body: {
        success: true,
      },
    };
  } catch (error) {
    console.error('Error deleting template:', error);
    return {
      status: 404,
      body: {
        message: 'Failed to delete template',
      },
    };
  }
}

type RenameTemplateRequest = ServerInferRequest<
  typeof cloudContracts.templates.renameTemplate
>;
type RenameTemplateResponse = ServerInferResponses<
  typeof cloudContracts.templates.renameTemplate
>;

async function renameTemplate(
  req: RenameTemplateRequest,
  context: SDKContext,
): Promise<RenameTemplateResponse> {
  const { organizationId } = getContextDataHack(req, context);
  const { project_id, template_name } = req.params;
  const { new_name } = req.body;

  // Strip version from template name if accidentally included
  const [nameWithoutVersion] = template_name.split(':');

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Get full project data with organization check
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, project.id),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!projectData) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Check if the current template exists
  const existingTemplates = await db.query.lettaTemplates.findMany({
    where: and(
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.projectId, projectData.id),
      eq(lettaTemplates.name, nameWithoutVersion),
    ),
  });

  if (existingTemplates.length === 0) {
    return {
      status: 404,
      body: {
        message: `Template '${nameWithoutVersion}' not found in project '${project.slug}'`,
      },
    };
  }

  // Check if a template with the new name already exists
  const conflictingTemplate = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.projectId, projectData.id),
      eq(lettaTemplates.name, new_name),
    ),
  });

  if (conflictingTemplate) {
    return {
      status: 409,
      body: {
        message: `Template '${new_name}' already exists in project '${project.slug}'`,
      },
    };
  }

  try {
    // Update all template versions with the new name
    await db
      .update(lettaTemplates)
      .set({ name: new_name })
      .where(
        and(
          eq(lettaTemplates.organizationId, organizationId),
          eq(lettaTemplates.projectId, projectData.id),
          eq(lettaTemplates.name, nameWithoutVersion),
        ),
      )
      .execute();

    return {
      status: 200,
      body: {
        success: true,
      },
    };
  } catch (error) {
    console.error('Error renaming template:', error);
    return {
      status: 400,
      body: {
        message: 'Failed to rename template',
      },
    };
  }
}

type ListTemplateVersionsRequest = ServerInferRequest<
  typeof cloudContracts.templates.listTemplateVersions
>;
type ListTemplateVersionsResponse = ServerInferResponses<
  typeof cloudContracts.templates.listTemplateVersions
>;

async function listTemplateVersions(
  req: ListTemplateVersionsRequest,
  context: SDKContext,
): Promise<ListTemplateVersionsResponse> {
  const { organizationId } = getContextDataHack(req, context);
  const { project_id, name } = req.params;
  const { offset = 0, limit = 50 } = req.query;

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Get full project data with organization check
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, project.id),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!projectData) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  try {
    // Get all template versions for this template name
    const templateVersions = await db.query.lettaTemplates.findMany({
      where: and(
        eq(lettaTemplates.organizationId, organizationId),
        eq(lettaTemplates.projectId, projectData.id),
        eq(lettaTemplates.name, name),
        not(eq(lettaTemplates.version, 'current')),
      ),
      orderBy: (lettaTemplates, { desc }) => [desc(lettaTemplates.createdAt)],
      offset,
      limit: limit + 1, // Get one extra to check if there's a next page
    });

    if (templateVersions.length === 0) {
      return {
        status: 404,
        body: {
          message: `Template '${name}' not found in project '${project.slug}'`,
        },
      };
    }

    // Check if there's a next page
    const hasNextPage = templateVersions.length > limit;
    const versionsToReturn = hasNextPage
      ? templateVersions.slice(0, limit)
      : templateVersions;

    // Get total count for pagination info
    const totalCountResult = await db
      .select({ count: count() })
      .from(lettaTemplates)
      .where(
        and(
          eq(lettaTemplates.organizationId, organizationId),
          eq(lettaTemplates.projectId, projectData.id),
          eq(lettaTemplates.name, name),
          not(eq(lettaTemplates.version, 'current')),
        ),
      );

    // Find the latest version
    const latestVersion = templateVersions[0]?.version;

    const versions = versionsToReturn.map((template) => ({
      version: template.version,
      created_at: template.createdAt.toISOString(),
      message: template.message || undefined,
      is_latest: template.version === latestVersion,
    }));

    return {
      status: 200,
      body: {
        versions,
        has_next_page: hasNextPage,
        total_count:
          totalCountResult.length > 0 ? totalCountResult[0].count : 0,
      },
    };
  } catch (error) {
    console.error('Error listing template versions:', error);
    return {
      status: 404,
      body: {
        message: 'Failed to list template versions',
      },
    };
  }
}

type UpdateTemplateDescriptionRequest = ServerInferRequest<
  typeof cloudContracts.templates.updateTemplateDescription
>;
type UpdateTemplateDescriptionResponse = ServerInferResponses<
  typeof cloudContracts.templates.updateTemplateDescription
>;

async function updateTemplateDescription(
  req: UpdateTemplateDescriptionRequest,
  context: SDKContext,
): Promise<UpdateTemplateDescriptionResponse> {
  const { organizationId } = getContextDataHack(req, context);
  const { project_id, template_name } = req.params;
  const { description } = req.body;

  // Strip version from template name if accidentally included
  const [nameWithoutVersion] = template_name.split(':');

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Get full project data with organization check
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, project.id),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!projectData) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Check if the template exists
  const existingTemplates = await db.query.lettaTemplates.findMany({
    where: and(
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.projectId, projectData.id),
      eq(lettaTemplates.name, nameWithoutVersion),
    ),
  });

  if (existingTemplates.length === 0) {
    return {
      status: 404,
      body: {
        message: `Template '${nameWithoutVersion}' not found in project '${project.slug}'`,
      },
    };
  }

  try {
    // Update all template versions with the new description
    await db
      .update(lettaTemplates)
      .set({ description: description || '' })
      .where(
        and(
          eq(lettaTemplates.organizationId, organizationId),
          eq(lettaTemplates.projectId, projectData.id),
          eq(lettaTemplates.name, nameWithoutVersion),
        ),
      )
      .execute();

    return {
      status: 200,
      body: {
        success: true,
      },
    };
  } catch (error) {
    console.error('Error updating template description:', error);
    return {
      status: 400,
      body: {
        message: 'Failed to update template description',
      },
    };
  }
}

type MigrateDeploymentRequest = ServerInferRequest<
  typeof cloudContracts.templates.migrateDeployment
>;
type MigrateDeploymentResponse = ServerInferResponses<
  typeof cloudContracts.templates.migrateDeployment
>;

async function migrateDeployment(
  req: MigrateDeploymentRequest,
  context: SDKContext,
): Promise<MigrateDeploymentResponse> {
  const { organizationId, lettaAgentsUserId } = getContextDataHack(
    req,
    context,
  );
  const { project_id, template_name, deployment_id } = req.params;
  const {
    version,
    preserve_tool_variables = false,
    preserve_core_memories = false,
    memory_variables,
  } = req.body;

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Get full project data with organization check
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, project.id),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!projectData) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Find the target template version
  const targetTemplate = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.projectId, projectData.id),
      eq(lettaTemplates.name, template_name),
      eq(lettaTemplates.version, version),
    ),
  });

  if (!targetTemplate) {
    return {
      status: 404,
      body: {
        message: `Template '${template_name}' version '${version}' not found in project '${project.slug}'`,
      },
    };
  }

  // Find the base template (current version)
  const baseTemplate = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.name, template_name),
      eq(lettaTemplates.projectId, projectData.id),
      eq(lettaTemplates.version, 'current'),
    ),
  });

  if (!baseTemplate) {
    return {
      status: 404,
      body: {
        message: `Base template 'current' version for '${template_name}' not found in project '${project.slug}'`,
      },
    };
  }

  try {
    // Check if temporal is available for background processing
    if (environment.TEMPORAL_LETTUCE_API_HOST) {
      await startMigrateDeploymentEntities({
        deploymentId: deployment_id,
        templateId: targetTemplate.id,
        preserveToolVariables: preserve_tool_variables,
        preserveCoreMemories: preserve_core_memories,
        organizationId,
        lettaAgentsId: lettaAgentsUserId,
        baseTemplateId: baseTemplate.id,
        memoryVariables: memory_variables || {},
      });

      return {
        status: 200,
        body: {
          success: true,
          message: 'Deployment migration started successfully',
        },
      };
    } else {
      // Fall back to direct execution
      await migrateDeploymentEntities({
        deploymentId: deployment_id,
        templateId: targetTemplate.id,
        preserveToolVariables: preserve_tool_variables,
        preserveCoreMemories: preserve_core_memories,
        organizationId,
        lettaAgentsUserId,
        baseTemplateId: baseTemplate.id,
        memoryVariables: memory_variables || {},
      });

      return {
        status: 200,
        body: {
          success: true,
          message: 'Deployment migration completed successfully',
        },
      };
    }
  } catch (error) {
    console.error('Error migrating deployment:', error);
    return {
      status: 500,
      body: {
        message: error instanceof Error ? error.message : 'Failed to migrate deployment',
      },
    };
  }
}

type SetCurrentTemplateFromSnapshotRequest = ServerInferRequest<
  typeof cloudContracts.templates.setCurrentTemplateFromSnapshot
>;
type SetCurrentTemplateFromSnapshotResponse = ServerInferResponses<
  typeof cloudContracts.templates.setCurrentTemplateFromSnapshot
>;

async function setCurrentTemplateFromSnapshotHandler(
  req: SetCurrentTemplateFromSnapshotRequest,
  context: SDKContext,
): Promise<SetCurrentTemplateFromSnapshotResponse> {
  const { organizationId } = getContextDataHack(req, context);
  const { project_id, template_version } = req.params;
  const snapshot = req.body;

  // Validate template_version format (must be template_name:current)
  if (!template_version.endsWith(':current')) {
    return {
      status: 400,
      body: {
        message: 'Only :current versions can be updated from snapshot',
      },
    };
  }

  const templateName = template_version.replace(':current', '');

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Get full project data with organization check
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, project.id),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!projectData) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  try {
    const result = await setCurrentTemplateFromSnapshot({
      projectId: projectData.id,
      templateName,
      organizationId,
      snapshot,
    });

    return {
      status: 200,
      body: result,
    };
  } catch (error) {
    console.error('Error setting current template from snapshot:', error);

    // Handle known errors
    if (error instanceof Error) {
      const knownErrors = Object.values(SET_CURRENT_TEMPLATE_FROM_SNAPSHOT_ERRORS);
      if (knownErrors.includes(error.message)) {
        return {
          status: 400,
          body: {
            message: error.message,
          },
        };
      }
    }

    return {
      status: 500,
      body: {
        message: 'Failed to set current template from snapshot',
      },
    };
  }
}

type UpdateCurrentTemplateFromAgentFileRequest = ServerInferRequest<
  typeof cloudContracts.templates.updateCurrentTemplateFromAgentFile
>;
type UpdateCurrentTemplateFromAgentFileResponse = ServerInferResponses<
  typeof cloudContracts.templates.updateCurrentTemplateFromAgentFile
>;

async function updateCurrentTemplateFromAgentFileHandler(
  req: UpdateCurrentTemplateFromAgentFileRequest,
  context: SDKContext,
): Promise<UpdateCurrentTemplateFromAgentFileResponse> {
  const { organizationId, lettaAgentsUserId } = getContextDataHack(req, context);
  const { project_id, template_name } = req.params;
  const { agent_file_json: agentFile, update_existing_tools = false, save_existing_changes = false } = req.body;

  const project = await getProjectFromSlugOrId(project_id, organizationId);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  // Get full project data with organization check
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, project.id),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!projectData) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  try {
    // Check if we need to save existing changes
    if (save_existing_changes) {
      try {
        // Get current and latest versions to compare snapshots
        const currentTemplate = await getTemplateByName({
          lettaAgentsId: lettaAgentsUserId,
          organizationId,
          versionString: `${projectData.slug}/${template_name}:current`,
        });

        const latestTemplate = await getTemplateByName({
          lettaAgentsId: lettaAgentsUserId,
          organizationId,
          versionString: `${projectData.slug}/${template_name}:latest`,
        });



        // Compare snapshots - if they're different, there are unsaved changes
        if (!deepEqual(currentTemplate, latestTemplate)) {
          // Save existing changes before updating
          await saveTemplate({
            projectSlug: projectData.slug,
            templateName: template_name,
            organizationId,
            lettaAgentsId: lettaAgentsUserId,
            message: 'Auto-save before updating from agent file',
          });
        }
      } catch (error) {
        // If save fails or comparison fails, log warning but continue
        console.warn('Failed to save existing changes before update:', error);
      }
    }

    const result = await updateTemplateFromAgentFile({
      projectId: projectData.id,
      templateName: template_name,
      organizationId,
      lettaAgentsId: lettaAgentsUserId,
      agentFile: agentFile as AgentFileSchema,
      updateExistingTools: update_existing_tools,
    });

    return {
      status: 200,
      body: result,
    };
  } catch (error) {
    console.error('Error updating current template from agent file:', error);

    // Handle known errors
    if (error instanceof Error) {
      const knownErrors = Object.values(UPDATE_TEMPLATE_FROM_AGENT_FILE_ERRORS);
      if (knownErrors.includes(error.message)) {
        return {
          status: 400,
          body: {
            message: error.message,
          },
        };
      }
    }

    return {
      status: 500,
      body: {
        message: 'Failed to update current template from agent file',
      },
    };
  }
}

export const templatesRouter = {
  createAgentsFromTemplate,
  listTemplates,
  getTemplateSnapshot,
  saveTemplateVersion,
  forkTemplate,
  createTemplate,
  deleteTemplate,
  renameTemplate,
  updateTemplateDescription,
  listTemplateVersions,
  migrateDeployment,
  setCurrentTemplateFromSnapshot: setCurrentTemplateFromSnapshotHandler,
  updateCurrentTemplateFromAgentFile: updateCurrentTemplateFromAgentFileHandler,
};

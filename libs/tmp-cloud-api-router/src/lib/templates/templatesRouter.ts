import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import type { cloudContracts } from '@letta-cloud/sdk-cloud-api';
import {
  db,
  deployedAgentMetadata,
  deployedAgentVariables,
  lettaTemplates,
  projects,
} from '@letta-cloud/service-database';
import type { SDKContext } from '../types';
import {
  getTemplateByName,
  migrateEntities,
  saveTemplate,
  forkTemplate as forkTemplateFn,
  createTemplateFromAgentState,
  createEntitiesFromTemplate,
} from '@letta-cloud/utils-server';
import { getContextDataHack } from '../getContextDataHack/getContextDataHack';
import { and, eq, ilike, count, not, desc } from 'drizzle-orm';
import { validateVersionString } from '@letta-cloud/utils-shared';
import { generateTemplateSnapshot } from '@letta-cloud/utils-shared';
import { environment } from '@letta-cloud/config-environment-variables';
import { startMigrateTemplateEntities } from '@letta-cloud/lettuce-client';
import { AgentsService, BlocksService } from '@letta-cloud/sdk-core';

type CreateAgentsFromTemplateRequest = ServerInferRequest<
  typeof cloudContracts.templates.createAgentsFromTemplate
>;
type CreateAgentsFromTemplateResponse = ServerInferResponses<
  typeof cloudContracts.templates.createAgentsFromTemplate
>;

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

  const { template_version, project: projectSlug } = req.params;

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

  const [template, project] = await Promise.all([
    getTemplateByName({
      versionString,
      organizationId,
      includeAgents: true,
      includeBlocks: true,
      lettaAgentsId: lettaAgentsUserId,
    }),
    db.query.projects.findFirst({
      where: and(
        eq(projects.slug, projectSlug),
        eq(projects.organizationId, organizationId),
      ),
      columns: {
        id: true,
      },
    }),
  ]);

  if (!project) {
    return {
      status: 404,
      body: {
        message: 'Project not found',
      },
    };
  }

  if (!template) {
    return {
      status: 404,
      body: {
        message:
          'This template does not exist, be sure to follow the following format: project_slug/template_name:version',
      },
    };
  }

  const [response] = await createEntitiesFromTemplate({
    projectId: project.id,
    lettaAgentsId: lettaAgentsUserId,
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

  if (!response?.id) {
    return {
      status: 500,
      body: {
        message: 'Failed to create agent from template',
      },
    };
  }

  await db.insert(deployedAgentMetadata).values({
    agentId: response.id,
    organizationId,
    projectId: project.id,
  });

  await db.insert(deployedAgentVariables).values({
    deployedAgentId: response.id,
    value: memory_variables || {},
    organizationId,
  });

  return {
    status: 201,
    body: {
      agents: [response],
    },
  };
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
    search,
    project_id,
    project_slug,
    template_id,
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
      ...[
        eq(lettaTemplates.organizationId, organizationId),
        ...!template_id ? [eq(lettaTemplates.latestDeployed, true)] : [],
        ...(search ? [ilike(lettaTemplates.name, `%${search}%`)] : []),
        ...(name ? [ilike(lettaTemplates.name, `%${name}%`)] : []),
        ...(projectId ? [eq(lettaTemplates.projectId, projectId)] : []),
        ...(template_id ? [eq(lettaTemplates.id, template_id)] : []),
      ],
    ),
    with: {
      project: {
        columns: {
          slug: true,
        },
      },
    },
    orderBy: [desc(lettaTemplates.createdAt)],
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
  const { template_version, project } = req.params;

  const versionString = `${project}/${template_version}`;

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

  return {
    status: 200,
    body: generateTemplateSnapshot(template),
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
  const { project, template_name } = req.params;
  const {
    preserve_environment_variables_on_migration = false,
    migrate_agents,
    preserve_core_memories_on_migration = false,
    message,
  } = req.body;

  const projectData = await db.query.projects.findFirst({
    where: eq(projects.slug, project),
    columns: {
      id: true,
    },
  });

  if (!projectData) {
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
    projectSlug: project,
    templateName: template_name,
    organizationId,
    lettaAgentsId: lettaAgentsUserId,
    message: message || '',
  });

  const versionString = `${project}/${template_name}:latest`;

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
    if (environment.TEMPORAL_LETTUCE_API_HOST) {
      await startMigrateTemplateEntities({
        preserveToolVariables: preserve_environment_variables_on_migration,
        versionString,
        preserveCoreMemories: preserve_core_memories_on_migration,
        organizationId,
        lettaAgentsId: lettaAgentsUserId,
      });
    } else {
      await migrateEntities({
        preserveToolVariables: preserve_environment_variables_on_migration,
        versionString,
        preserveCoreMemories: preserve_core_memories_on_migration,
        organizationId,
        lettaAgentsId: lettaAgentsUserId,
      });
    }
  }

  return {
    status: 200,
    body: {
      id: newVersion.id,
      name: newVersion.name,
      project_slug: project,
      project_id: newVersion.projectId,
      description: newVersion.description || '',
      latest_version: newVersion.version,
      template_deployment_slug: `${project}/${newVersion.name}:${newVersion.version}`,
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
  const { template_version, project } = req.params;
  const { name } = req.body || {};

  const versionString = `${project}/${template_version}`;

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
      projectSlug: project,
      name,
    });

    return {
      status: 200,
      body: {
        id: newTemplate.id,
        name: newTemplate.name,
        project_slug: project,
        project_id: newTemplate.projectId,
        description: newTemplate.description || '',
        latest_version: newTemplate.version,
        template_deployment_slug: `${project}/${newTemplate.name}:${newTemplate.version}`,
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
  const { project } = req.params;
  const { agent_id, name } = req.body;

  // Get the project by slug
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.slug, project),
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
    // Retrieve the agent to create template from
    const agentState = await AgentsService.retrieveAgent(
      {
        agentId: agent_id,
      },
      {
        user_id: lettaAgentsUserId,
      },
    );

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
    const { lettaTemplate, projectSlug } = await createTemplateFromAgentState({
      projectId: projectData.id,
      organizationId,
      lettaAgentsId: lettaAgentsUserId,
      userId,
      agentState,
      name,
    });

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
      },
    };
  } catch (error) {
    console.error('Error creating template:', error);
    return {
      status: 400,
      body: {
        message: 'Failed to create template from agent',
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
  const { project, template_name } = req.params;

  // Get the project by slug
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.slug, project),
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
          message: `Template '${template_name}' not found in project '${project}'`,
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
  const { project, template_name } = req.params;
  const { new_name } = req.body;

  // Strip version from template name if accidentally included
  const [nameWithoutVersion] = template_name.split(':');

  // Get the project by slug
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.slug, project),
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
        message: `Template '${nameWithoutVersion}' not found in project '${project}'`,
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
        message: `Template '${new_name}' already exists in project '${project}'`,
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
  const { project_slug, name } = req.params;
  const { offset = 0, limit = 50 } = req.query;

  // Get the project by slug
  const projectData = await db.query.projects.findFirst({
    where: and(
      eq(projects.slug, project_slug),
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
          message: `Template '${name}' not found in project '${project_slug}'`,
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

export const templatesRouter = {
  createAgentsFromTemplate,
  listTemplates,
  getTemplateSnapshot,
  saveTemplateVersion,
  forkTemplate,
  createTemplate,
  deleteTemplate,
  renameTemplate,
  listTemplateVersions,
};

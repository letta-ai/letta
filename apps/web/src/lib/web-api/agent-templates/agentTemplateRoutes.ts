import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import {
  getUserOrThrow,
  getUserWithActiveOrganizationIdOrThrow,
} from '$web/server/auth';
import { and, desc, eq, ilike, isNull } from 'drizzle-orm';
import {
  agentTemplates,
  db,
  deployedAgentTemplates,
} from '@letta-cloud/service-database';
import { AgentsService } from '@letta-cloud/sdk-core';
import type { AgentState } from '@letta-cloud/sdk-core';
import {
  getDeployedTemplateByVersion,
  getTemplateProjectId,
} from '@letta-cloud/utils-server';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { createTemplate } from 'tmp-cloud-api-router';
import type { GeneralRequestContext } from '../../server';
import { listTemplateAgentMigrations } from '$web/server/lib/listTemplateAgentMigrations/listTemplateAgentMigrations';
import { abortTemplateAgentMigration } from '$web/server/lib/abortTemplateAgentMigration/abortTemplateAgentMigration';
import { findMemoryBlockVariables } from '@letta-cloud/utils-shared';

function randomThreeDigitNumber() {
  return Math.floor(Math.random() * 1000);
}

function getDateAsAlphanumericString(date: Date): string {
  return date.valueOf().toString(36) + randomThreeDigitNumber().toString(36);
}

type ListAgentTemplatesQueryRequest = ServerInferRequest<
  typeof contracts.agentTemplates.listAgentTemplates
>;

type ListAgentTemplatesQueryResponse = ServerInferResponses<
  typeof contracts.agentTemplates.listAgentTemplates
>;

export async function listAgentTemplates(
  req: ListAgentTemplatesQueryRequest,
): Promise<ListAgentTemplatesQueryResponse> {
  const {
    search,
    offset,
    includeLatestDeployedVersion,
    includeAgentState,
    limit = 10,
    projectId,
    name,
  } = req.query;

  const {
    activeOrganizationId: organizationId,
    permissions,
    lettaAgentsId,
  } = await getUserOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  if (!organizationId) {
    return {
      status: 404,
      body: {},
    };
  }

  const where = [
    eq(agentTemplates.organizationId, organizationId),
    isNull(agentTemplates.deletedAt),
  ];

  if (projectId) {
    where.push(eq(agentTemplates.projectId, projectId));
  }

  if (search) {
    where.push(ilike(agentTemplates.name, `%${search}%`));
  }

  if (name) {
    where.push(eq(agentTemplates.name, name));
  }

  const agentTemplatesResponse = await db.query.agentTemplates.findMany({
    where: and(...where),
    limit: limit + 1,
    offset,
    with: {
      ...(includeLatestDeployedVersion && {
        deployedAgentTemplates: {
          limit: 1,
          where: isNull(deployedAgentTemplates.deletedAt),
          orderBy: [desc(deployedAgentTemplates.createdAt)],
        },
      }),
    },
    orderBy: [desc(agentTemplates.createdAt)],
    columns: {
      name: true,
      id: true,
      updatedAt: true,
    },
  });

  const hasNextPage = agentTemplatesResponse.length > limit;

  const agentStateMap = new Map<string, AgentState>();
  if (includeAgentState) {
    const agentStates = await Promise.all(
      agentTemplatesResponse.map((agentTemplate) =>
        AgentsService.retrieveAgent(
          {
            agentId: agentTemplate.id,
          },
          {
            user_id: lettaAgentsId,
          },
        ).catch(() => null),
      ),
    );

    agentStates.forEach((agentState, index) => {
      if (!agentState) {
        return;
      }

      agentStateMap.set(agentTemplatesResponse[index].id, agentState);
    });
  }

  return {
    status: 200,
    body: {
      agentTemplates: agentTemplatesResponse
        .slice(0, limit)
        .map((agentTemplate) => {
          return {
            name: agentTemplate.name,
            id: agentTemplate.id,

            updatedAt: agentTemplate.updatedAt.toISOString(),
            ...(includeAgentState
              ? {
                  agentState: agentStateMap.get(agentTemplate.id),
                }
              : {}),
            ...(includeLatestDeployedVersion
              ? {
                  latestDeployedVersion:
                    agentTemplate.deployedAgentTemplates[0]?.version,
                  latestDeployedId: agentTemplate.deployedAgentTemplates[0]?.id,
                }
              : {}),
          };
        }),
      hasNextPage,
    },
  };
}

type GetAgentTemplateByIdRequest = ServerInferRequest<
  typeof contracts.agentTemplates.getAgentTemplateById
>;

type GetAgentTemplateByIdResponse = ServerInferResponses<
  typeof contracts.agentTemplates.getAgentTemplateById
>;

export async function getAgentTemplateById(
  req: GetAgentTemplateByIdRequest,
): Promise<GetAgentTemplateByIdResponse> {
  const { id } = req.params;
  const { includeState } = req.query;
  const { activeOrganizationId, permissions, lettaAgentsId } =
    await getUserOrThrow();

  if (!activeOrganizationId) {
    return {
      status: 404,
      body: {},
    };
  }

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  const agentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.id, id),
      isNull(agentTemplates.deletedAt),
    ),
  });

  if (!agentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      agentState: includeState
        ? await AgentsService.retrieveAgent(
            {
              agentId: agentTemplate.id,
            },
            {
              user_id: lettaAgentsId,
            },
          )
        : undefined,
      name: agentTemplate.name,
      id: agentTemplate.id,
      updatedAt: agentTemplate.updatedAt.toISOString(),
    },
  };
}

type ForkAgentTemplateRequest = ServerInferRequest<
  typeof contracts.agentTemplates.forkAgentTemplate
>;

type ForkAgentTemplateResponse = ServerInferResponses<
  typeof contracts.agentTemplates.forkAgentTemplate
>;

export async function forkAgentTemplate(
  req: ForkAgentTemplateRequest,
): Promise<ForkAgentTemplateResponse> {
  const { agentTemplateId, projectId } = req.params;
  const {
    activeOrganizationId,
    lettaAgentsId,
    permissions,
    id: userId,
  } = await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  const testingAgent = await db.query.agentTemplates.findFirst({
    where: and(
      isNull(agentTemplates.deletedAt),
      eq(agentTemplates.organizationId, activeOrganizationId),
      eq(agentTemplates.projectId, projectId),
      eq(agentTemplates.id, agentTemplateId),
    ),
  });

  if (!testingAgent) {
    return {
      status: 404,
      body: {},
    };
  }

  const agentDetails = await AgentsService.retrieveAgent(
    {
      agentId: testingAgent.id,
    },
    {
      user_id: lettaAgentsId,
    },
  );

  const name = `forked-${testingAgent.name}-${getDateAsAlphanumericString(new Date())}`;

  const copiedTemplate = await createTemplate({
    projectId,
    organizationId: activeOrganizationId,
    lettaAgentsId,
    userId,
    name,
    createAgentState: {
      include_base_tools: false,
      tool_rules: agentDetails.tool_rules,
      tool_exec_environment_variables:
        agentDetails.tool_exec_environment_variables?.reduce(
          (v, c) => {
            return {
              ...v,
              [c.key]: c.value,
            };
          },
          {} as Record<string, string>,
        ),
      llm_config: agentDetails.llm_config,
      embedding_config: agentDetails.embedding_config,
      system: agentDetails.system,
      tool_ids: agentDetails.tools
        .map((tool) => tool.id)
        .filter(Boolean) as string[],
      memory_blocks: agentDetails.memory.blocks.map((block) => {
        return {
          limit: block.limit,
          label: block.label || '',
          value: block.value,
        };
      }),
    },
  });

  return {
    status: 201,
    body: {
      id: copiedTemplate.templateId,
      name: copiedTemplate.templateName,
      updatedAt: new Date().toISOString(),
    },
  };
}

type GetAgentTemplateByVersion = ServerInferRequest<
  typeof contracts.agentTemplates.getAgentTemplateByVersion
>;

type GetAgentTemplateByVersionResponse = ServerInferResponses<
  typeof contracts.agentTemplates.getAgentTemplateByVersion
>;

async function getAgentTemplateByVersion(
  req: GetAgentTemplateByVersion,
): Promise<GetAgentTemplateByVersionResponse> {
  const { slug } = req.params;
  const { lettaAgentsId, permissions, activeOrganizationId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  const [versionName] = slug.split(':');
  const deployedAgentTemplate = await getDeployedTemplateByVersion(
    slug,
    activeOrganizationId,
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {
        message: 'Template version provided does not exist',
      },
    };
  }

  const agent = await AgentsService.retrieveAgent(
    {
      agentId: deployedAgentTemplate.id,
    },
    {
      user_id: lettaAgentsId,
    },
  );

  return {
    status: 200,
    body: {
      fullVersion: `${versionName}:${deployedAgentTemplate.version}`,
      version: deployedAgentTemplate.version,
      id: deployedAgentTemplate.id,
      state: agent,
    },
  };
}

type GetDeployedAgentTemplateByIdRequest = ServerInferRequest<
  typeof contracts.agentTemplates.getDeployedAgentTemplateById
>;

type GetDeployedAgentTemplateByIdResponse = ServerInferResponses<
  typeof contracts.agentTemplates.getDeployedAgentTemplateById
>;

export async function getDeployedAgentTemplateById(
  req: GetDeployedAgentTemplateByIdRequest,
): Promise<GetDeployedAgentTemplateByIdResponse> {
  const { id } = req.params;
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  const deployedAgentTemplate = await db.query.deployedAgentTemplates.findFirst(
    {
      where: and(
        eq(deployedAgentTemplates.organizationId, activeOrganizationId),
        eq(deployedAgentTemplates.id, id),
        isNull(deployedAgentTemplates.deletedAt),
      ),
      with: {
        agentTemplate: {
          columns: {
            name: true,
          },
        },
      },
    },
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      fullVersion: `${deployedAgentTemplate.agentTemplate.name}:${deployedAgentTemplate.version}`,
      agentTemplateId: deployedAgentTemplate.agentTemplateId,
      id: deployedAgentTemplate.id,
      projectId: deployedAgentTemplate.projectId,
      createdAt: deployedAgentTemplate.createdAt.toISOString(),
      templateName: deployedAgentTemplate.agentTemplate.name,
    },
  };
}

type ListTemplateVersions = ServerInferRequest<
  typeof contracts.agentTemplates.listTemplateVersions
>;

type ListTemplateVersionsResponse = ServerInferResponses<
  typeof contracts.agentTemplates.listTemplateVersions
>;

async function listTemplateVersions(
  req: ListTemplateVersions,
): Promise<ListTemplateVersionsResponse> {
  const { agentTemplateId } = req.params;
  const { limit = 5, offset, versionId } = req.query;

  const response = await db.query.deployedAgentTemplates.findMany({
    where: and(
      ...[
        eq(deployedAgentTemplates.agentTemplateId, agentTemplateId),
        isNull(deployedAgentTemplates.deletedAt),
        ...(versionId ? [eq(deployedAgentTemplates.id, versionId)] : []),
      ],
    ),
    limit: limit + 1,
    offset,
    orderBy: [desc(deployedAgentTemplates.createdAt)],
  });

  return {
    status: 200,
    body: {
      versions: response.slice(0, limit).map((version) => {
        return {
          id: version.id,
          message: version.message || undefined,
          version: version.version,
          agentTemplateId: version.agentTemplateId,
          createdAt: version.createdAt.toISOString(),
        };
      }),
      hasNextPage: response.length > limit,
    },
  };
}

type ImportAgentFileAsTemplateRequest = ServerInferRequest<
  typeof contracts.agentTemplates.importAgentFileAsTemplate
>;

type ImportAgentFileAsTemplateResponse = ServerInferResponses<
  typeof contracts.agentTemplates.importAgentFileAsTemplate
>;

async function importAgentFileAsTemplate(
  req: ImportAgentFileAsTemplateRequest,
  context: GeneralRequestContext,
): Promise<ImportAgentFileAsTemplateResponse> {
  const {
    activeOrganizationId,
    permissions,
    id: userId,
    lettaAgentsId,
  } = await getUserWithActiveOrganizationIdOrThrow();

  const { append_copy_suffix, override_existing_tools, project_id } = req.query;

  if (!permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  if (typeof project_id !== 'string') {
    return {
      status: 400,
      body: {
        message: 'project_id is required',
      },
    };
  }

  const form = await context.request.formData();

  const file = form.get('file');

  if (!file) {
    return {
      status: 400,
      body: {
        message: 'file is required',
      },
    };
  }

  const agent = await AgentsService.importAgentSerialized({
    formData: {
      file: file as Blob,
    },
    projectId: getTemplateProjectId(project_id),
    appendCopySuffix: append_copy_suffix,
    stripMessages: true,
    overrideExistingTools: override_existing_tools,
  });

  const response = await createTemplate({
    projectId: project_id,
    organizationId: activeOrganizationId,
    userId,
    lettaAgentsId: lettaAgentsId,
    createAgentState: {
      llm_config: agent.llm_config,
      embedding_config: agent.embedding_config,
      system: agent.system,
      enable_sleeptime: agent.enable_sleeptime,
      include_base_tool_rules: false,
      include_multi_agent_tools: false,
      agent_type: agent.agent_type,
      tool_exec_environment_variables:
        agent.tool_exec_environment_variables?.reduce(
          (v, c) => ({
            ...v,
            [c.key]: c.value,
          }),
          {} as Record<string, string>,
        ),
      description: agent.description,
      tool_ids: agent.tools.map((tool) => tool.id || '').filter(Boolean),
      tool_rules: agent.tool_rules,
      memory_blocks: agent.memory.blocks.map((block) => {
        return {
          limit: block.limit,
          label: block.label || '',
          value: block.value,
        };
      }),
    },
  });

  return {
    status: 201,
    body: {
      id: response.templateId,
      name: response.templateName,
    },
  };
}

type ListAgentMigrationsRequest = ServerInferRequest<
  typeof contracts.agentTemplates.listAgentMigrations
>;

type ListAgentMigrationsResponse = ServerInferResponses<
  typeof contracts.agentTemplates.listAgentMigrations
>;

async function listAgentMigrations(
  req: ListAgentMigrationsRequest,
): Promise<ListAgentMigrationsResponse> {
  const { templateName, limit, cursor } = req.query;
  const { activeOrganizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();
  const organizationId = activeOrganizationId;

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  if (!templateName) {
    return {
      status: 400,
      body: {
        message: 'Template name is required',
      },
    };
  }

  const nextPageToken = cursor
    ? new TextEncoder().encode(JSON.stringify(cursor))
    : null;

  const response = await listTemplateAgentMigrations({
    templateName,
    organizationId,
    pageSize: limit,
    nextPageToken,
  });

  try {
    return {
      status: 200,
      body: {
        migrations: response.migrations,
        nextPage: response.nextPage ? response.nextPage.toString() : null,
      },
    };
  } catch (error) {
    console.error('Error fetching migrations from Temporal:', error);
    return {
      status: 500,
      body: {
        message: error as string,
      },
    };
  }
}

type AbortAgentMigrationRequest = ServerInferRequest<
  typeof contracts.agentTemplates.abortAgentMigration
>;

type AbortAgentMigrationResponse = ServerInferResponses<
  typeof contracts.agentTemplates.abortAgentMigration
>;

/**
 * Aborts an ongoing agent migration workflow
 * @param req - Request with workflow ID to abort
 * @returns Response with success or error status
 */
async function abortAgentMigration(
  req: AbortAgentMigrationRequest,
): Promise<AbortAgentMigrationResponse> {
  const { workflowId } = req.params;
  const { permissions } = await getUserWithActiveOrganizationIdOrThrow();
  try {
    if (!permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)) {
      return {
        status: 403,
        body: {
          success: false,
          message: 'Insufficient permissions to abort agent migration',
        },
      };
    }
    await abortTemplateAgentMigration(workflowId);
    return {
      status: 200,
      body: {
        success: true,
      },
    };
  } catch (error) {
    console.error('Error aborting agent migration:', error);
    return {
      status: 500,
      body: {
        success: false,
        message: `Failed to abort migration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

type UpdateTemplateNameRequest = ServerInferRequest<
  typeof contracts.agentTemplates.updateTemplateName
>;

type UpdateTemplateNameResponse = ServerInferResponses<
  typeof contracts.agentTemplates.updateTemplateName
>;

async function updateTemplateName(
  req: UpdateTemplateNameRequest,
): Promise<UpdateTemplateNameResponse> {
  const { agentTemplateId } = req.params;
  const { name } = req.body;

  const { activeOrganizationId, lettaAgentsId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  const updatedAgentTemplate = await db
    .update(agentTemplates)
    .set({
      name,
    })
    .where(
      and(
        eq(agentTemplates.id, agentTemplateId),
        eq(agentTemplates.organizationId, activeOrganizationId),
        isNull(agentTemplates.deletedAt),
      ),
    )
    .returning({
      id: agentTemplates.id,
      name: agentTemplates.name,
      updatedAt: agentTemplates.updatedAt,
    });

  await AgentsService.modifyAgent(
    {
      agentId: agentTemplateId,
      requestBody: {
        name,
      },
    },
    {
      user_id: lettaAgentsId,
    },
  );

  if (updatedAgentTemplate.length === 0) {
    return {
      status: 404,
      body: {},
    };
  }

  return {
    status: 200,
    body: {
      id: updatedAgentTemplate[0].id,
      name: updatedAgentTemplate[0].name,
      updatedAt: updatedAgentTemplate[0].updatedAt.toISOString(),
    },
  };
}

type GetAgentTemplateMemoryVariablesRequest = ServerInferRequest<
  typeof contracts.agentTemplates.getAgentTemplateMemoryVariables
>;

type GetAgentTemplateMemoryVariablesResponse = ServerInferResponses<
  typeof contracts.agentTemplates.getAgentTemplateMemoryVariables
>;

async function getAgentTemplateMemoryVariables(
  req: GetAgentTemplateMemoryVariablesRequest,
): Promise<GetAgentTemplateMemoryVariablesResponse> {
  const { name } = req.query;
  const { activeOrganizationId, permissions, lettaAgentsId } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_TEMPLATES)) {
    return {
      status: 403,
      body: {},
    };
  }

  const [baseName, version] = name.split(':');

  if (version === 'current') {
    // get the current template Id
    const currentTemplate = await db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, activeOrganizationId),
        eq(agentTemplates.name, baseName),
        isNull(agentTemplates.deletedAt),
      ),
    });

    if (!currentTemplate) {
      return {
        status: 404,
        body: {},
      };
    }

    const agent = await AgentsService.retrieveAgent(
      {
        agentId: currentTemplate.id,
      },
      {
        user_id: lettaAgentsId,
      },
    );

    const memoryVariables = findMemoryBlockVariables(agent);

    return {
      status: 200,
      body: {
        memoryVariables,
      },
    };
  }

  const deployedAgentTemplate = await getDeployedTemplateByVersion(
    name,
    activeOrganizationId,
  );

  if (!deployedAgentTemplate) {
    return {
      status: 404,
      body: {},
    };
  }

  const memoryVariables = deployedAgentTemplate.memoryVariables?.data;

  return {
    status: 200,
    body: {
      memoryVariables: Array.isArray(memoryVariables)
        ? memoryVariables.reduce((acc, curr) => {
            if (typeof curr.key === 'string') {
              acc.push(curr.key);
            }
            return acc;
          }, [] as string[])
        : [],
    },
  };
}

export const agentTemplateRoutes = {
  listAgentMigrations,
  abortAgentMigration,
  listAgentTemplates,
  getAgentTemplateByVersion,
  forkAgentTemplate,
  listTemplateVersions,
  getAgentTemplateById,
  updateTemplateName,
  getDeployedAgentTemplateById,
  importAgentFileAsTemplate,
  getAgentTemplateMemoryVariables,
};

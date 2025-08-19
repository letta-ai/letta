import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '../contracts';
import {
  getUserOrThrow,
  getUserWithActiveOrganizationIdOrThrow,
} from '$web/server/auth';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  agentTemplates,
  db,
  deployedAgentTemplates,
} from '@letta-cloud/service-database';
import { AgentsService } from '@letta-cloud/sdk-core';
import {
  getDeployedDeprecatedTemplateByVersion,
} from '@letta-cloud/utils-server';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import type { GeneralRequestContext } from '../../server';
import { listTemplateAgentMigrations } from '$web/server/lib/listTemplateAgentMigrations/listTemplateAgentMigrations';
import { abortTemplateAgentMigration } from '$web/server/lib/abortTemplateAgentMigration/abortTemplateAgentMigration';
import { findMemoryBlockVariables } from '@letta-cloud/utils-shared';


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
  const deployedAgentTemplate = await getDeployedDeprecatedTemplateByVersion(
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
      eq(deployedAgentTemplates.agentTemplateId, agentTemplateId),
      isNull(deployedAgentTemplates.deletedAt),
      ...(versionId ? [eq(deployedAgentTemplates.id, versionId)] : []),
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
    permissions,
  } = await getUserWithActiveOrganizationIdOrThrow();

  const { project_id } = req.body;

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
  return {
    status: 201,
    body: {
      id: 'response.templateId',
      name: 'response.templateName',
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

  const deployedAgentTemplate = await getDeployedDeprecatedTemplateByVersion(
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
  getAgentTemplateByVersion,
  listTemplateVersions,
  getAgentTemplateById,
  updateTemplateName,
  getDeployedAgentTemplateById,
  importAgentFileAsTemplate,
  getAgentTemplateMemoryVariables,
};

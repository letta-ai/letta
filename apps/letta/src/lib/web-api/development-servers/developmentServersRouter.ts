import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type {
  developmentServersContracts,
  UpdateDevelopmentServerRequestSchemaType,
} from '$letta/web-api/development-servers/developmentServersContracts';
import { getUserActiveOrganizationIdOrThrow } from '$letta/server/auth';
import { and, eq, like } from 'drizzle-orm';
import { db, developmentServers } from '@letta-web/database';

type GetDevelopmentServerRequest = ServerInferRequest<
  typeof developmentServersContracts.getDevelopmentServers
>;
type GetDevelopmentServerResponse = ServerInferResponses<
  typeof developmentServersContracts.getDevelopmentServers
>;

async function getDevelopmentServers(
  request: GetDevelopmentServerRequest
): Promise<GetDevelopmentServerResponse> {
  const { query } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const { search, offset, limit } = query;

  const where = [eq(developmentServers.organizationId, organizationId)];

  if (search) {
    where.push(like(developmentServers.name, `%${search}%`));
  }

  const response = await db.query.developmentServers.findMany({
    where: and(...where),
    offset,
    limit,
    columns: {
      id: true,
      name: true,
      url: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    status: 200,
    body: {
      developmentServers: response.map((developmentServer) => ({
        id: developmentServer.id,
        name: developmentServer.name,
        url: developmentServer.url,
        createdAt: developmentServer.createdAt.toISOString(),
        updatedAt: developmentServer.updatedAt.toISOString(),
      })),
    },
  };
}

type CreateDevelopmentServerRequest = ServerInferRequest<
  typeof developmentServersContracts.createDevelopmentServer
>;
type CreateDevelopmentServerResponse = ServerInferResponses<
  typeof developmentServersContracts.createDevelopmentServer
>;

async function createDevelopmentServer(
  request: CreateDevelopmentServerRequest
): Promise<CreateDevelopmentServerResponse> {
  const { body } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const [developmentServer] = await db
    .insert(developmentServers)
    .values({
      name: body.name,
      url: body.url,
      organizationId,
    })
    .returning({ id: developmentServers.id });

  return {
    status: 201,
    body: {
      developmentServer: {
        id: developmentServer.id,
        name: body.name,
        url: body.url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

type UpdateDevelopmentServerRequest = ServerInferRequest<
  typeof developmentServersContracts.updateDevelopmentServer
>;
type UpdateDevelopmentServerResponse = ServerInferResponses<
  typeof developmentServersContracts.updateDevelopmentServer
>;

async function updateDevelopmentServer(
  request: UpdateDevelopmentServerRequest
): Promise<UpdateDevelopmentServerResponse> {
  const { body, params } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const valuesToUpdate: UpdateDevelopmentServerRequestSchemaType = {};

  if (body.name) {
    valuesToUpdate.name = body.name;
  }

  if (body.url) {
    valuesToUpdate.url = body.url;
  }

  if (!Object.keys(valuesToUpdate).length) {
    return {
      status: 400,
      body: {
        error: 'Nothing to update',
      },
    };
  }

  const [developmentServer] = await db
    .update(developmentServers)
    .set(valuesToUpdate)
    .where(
      and(
        eq(developmentServers.id, params.developmentServerId),
        eq(developmentServers.organizationId, organizationId)
      )
    )
    .returning({
      id: developmentServers.id,
      name: developmentServers.name,
      url: developmentServers.url,
      createdAt: developmentServers.createdAt,
      updatedAt: developmentServers.updatedAt,
    });

  return {
    status: 200,
    body: {
      developmentServer: {
        id: developmentServer.id,
        name: developmentServer.name,
        url: developmentServer.url,
        createdAt: developmentServer.createdAt.toISOString(),
        updatedAt: developmentServer.updatedAt.toISOString(),
      },
    },
  };
}

type DeleteDevelopmentServerRequest = ServerInferRequest<
  typeof developmentServersContracts.deleteDevelopmentServer
>;
type DeleteDevelopmentServerResponse = ServerInferResponses<
  typeof developmentServersContracts.deleteDevelopmentServer
>;

async function deleteDevelopmentServer(
  request: DeleteDevelopmentServerRequest
): Promise<DeleteDevelopmentServerResponse> {
  const { params } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  await db
    .delete(developmentServers)
    .where(
      and(
        eq(developmentServers.id, params.developmentServerId),
        eq(developmentServers.organizationId, organizationId)
      )
    );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const developmentServersRouter = {
  getDevelopmentServers,
  createDevelopmentServer,
  updateDevelopmentServer,
  deleteDevelopmentServer,
};

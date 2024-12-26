import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type {
  developmentServersContracts,
  UpdateDevelopmentServerRequestSchemaType,
} from '$web/web-api/development-servers/developmentServersContracts';
import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import { and, eq, ilike } from 'drizzle-orm';
import {
  db,
  developmentServerPasswords,
  developmentServers,
} from '@letta-web/database';

type GetDevelopmentServersRequest = ServerInferRequest<
  typeof developmentServersContracts.getDevelopmentServers
>;
type GetDevelopmentServersResponse = ServerInferResponses<
  typeof developmentServersContracts.getDevelopmentServers
>;

async function getDevelopmentServers(
  request: GetDevelopmentServersRequest
): Promise<GetDevelopmentServersResponse> {
  const { query } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const { search, offset, limit } = query;

  const where = [eq(developmentServers.organizationId, organizationId)];

  if (search) {
    where.push(ilike(developmentServers.name, `%${search}%`));
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
    with: {
      developmentServerPasswords: {
        columns: {
          password: true,
        },
      },
    },
  });

  return {
    status: 200,
    body: {
      developmentServers: response.map((developmentServer) => ({
        id: developmentServer.id,
        name: developmentServer.name,
        url: developmentServer.url,
        password: developmentServer.developmentServerPasswords?.password || '',
        createdAt: developmentServer.createdAt.toISOString(),
        updatedAt: developmentServer.updatedAt.toISOString(),
      })),
    },
  };
}

type GetDevelopmentServerRequest = ServerInferRequest<
  typeof developmentServersContracts.getDevelopmentServer
>;

type GetDevelopmentServerResponse = ServerInferResponses<
  typeof developmentServersContracts.getDevelopmentServer
>;

async function getDevelopmentServer(
  request: GetDevelopmentServerRequest
): Promise<GetDevelopmentServerResponse> {
  const { params } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const developmentServer = await db.query.developmentServers.findFirst({
    where: and(
      eq(developmentServers.id, params.developmentServerId),
      eq(developmentServers.organizationId, organizationId)
    ),
    columns: {
      id: true,
      name: true,
      url: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      developmentServerPasswords: {
        columns: {
          password: true,
        },
      },
    },
  });

  if (!developmentServer) {
    return {
      status: 404,
      body: {
        error: 'Development server not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      developmentServer: {
        id: developmentServer.id,
        name: developmentServer.name,
        password: developmentServer.developmentServerPasswords?.password || '',
        url: developmentServer.url,
        createdAt: developmentServer.createdAt.toISOString(),
        updatedAt: developmentServer.updatedAt.toISOString(),
      },
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

  await db.insert(developmentServerPasswords).values({
    developmentServerId: developmentServer.id,
    password: body.password,
    organizationId,
  });

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

  if (body.password) {
    await db
      .update(developmentServerPasswords)
      .set({ password: body.password })
      .where(
        and(
          eq(
            developmentServerPasswords.developmentServerId,
            params.developmentServerId
          ),
          eq(developmentServerPasswords.organizationId, organizationId)
        )
      );
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
  getDevelopmentServer,
  deleteDevelopmentServer,
};

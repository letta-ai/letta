import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';

import { getUserActiveOrganizationIdOrThrow } from '$web/server/auth';
import { and, eq, ilike } from 'drizzle-orm';
import {
  db,
  developmentServerPasswords,
  developmentServers,
} from '@letta-cloud/service-database';
import type { contracts } from '@letta-cloud/sdk-web';

type GetDevelopmentServersRequest = ServerInferRequest<
  typeof contracts.developmentServers.getDevelopmentServers
>;
type GetDevelopmentServersResponse = ServerInferResponses<
  typeof contracts.developmentServers.getDevelopmentServers
>;

async function getDevelopmentServers(
  request: GetDevelopmentServersRequest,
): Promise<GetDevelopmentServersResponse> {
  const { query } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const { search, offset, limit = 5 } = query;

  const where = [eq(developmentServers.organizationId, organizationId)];

  if (search) {
    where.push(ilike(developmentServers.name, `%${search}%`));
  }

  const response = await db.query.developmentServers.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
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
      })).slice(0, limit),
      hasMore: response.length > limit,
    },
  };
}

type GetDevelopmentServerRequest = ServerInferRequest<
  typeof contracts.developmentServers.getDevelopmentServer
>;

type GetDevelopmentServerResponse = ServerInferResponses<
  typeof contracts.developmentServers.getDevelopmentServer
>;

async function getDevelopmentServer(
  request: GetDevelopmentServerRequest,
): Promise<GetDevelopmentServerResponse> {
  const { params } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const developmentServer = await db.query.developmentServers.findFirst({
    where: and(
      eq(developmentServers.id, params.developmentServerId),
      eq(developmentServers.organizationId, organizationId),
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
  typeof contracts.developmentServers.createDevelopmentServer
>;
type CreateDevelopmentServerResponse = ServerInferResponses<
  typeof contracts.developmentServers.createDevelopmentServer
>;

async function createDevelopmentServer(
  request: CreateDevelopmentServerRequest,
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
  typeof contracts.developmentServers.updateDevelopmentServer
>;
type UpdateDevelopmentServerResponse = ServerInferResponses<
  typeof contracts.developmentServers.updateDevelopmentServer
>;

async function updateDevelopmentServer(
  request: UpdateDevelopmentServerRequest,
): Promise<UpdateDevelopmentServerResponse> {
  const { body, params } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  const valuesToUpdate: UpdateDevelopmentServerRequest['body'] = {};

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
            params.developmentServerId,
          ),
          eq(developmentServerPasswords.organizationId, organizationId),
        ),
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
        eq(developmentServers.organizationId, organizationId),
      ),
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
  typeof contracts.developmentServers.deleteDevelopmentServer
>;
type DeleteDevelopmentServerResponse = ServerInferResponses<
  typeof contracts.developmentServers.deleteDevelopmentServer
>;

async function deleteDevelopmentServer(
  request: DeleteDevelopmentServerRequest,
): Promise<DeleteDevelopmentServerResponse> {
  const { params } = request;
  const organizationId = await getUserActiveOrganizationIdOrThrow();

  await db
    .delete(developmentServers)
    .where(
      and(
        eq(developmentServers.id, params.developmentServerId),
        eq(developmentServers.organizationId, organizationId),
      ),
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

import { db, datasets, projects } from '@letta-cloud/service-database';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { and, eq, ilike } from 'drizzle-orm';
import { ApplicationServices } from '@letta-cloud/service-rbac';

type CreateDatasetRequest = ServerInferRequest<
  typeof contracts.dataset.createDataset
>;
type CreateDatasetResponse = ServerInferResponses<
  typeof contracts.dataset.createDataset
>;

export async function createDataset(
  req: CreateDatasetRequest,
): Promise<CreateDatasetResponse> {
  const { name, description, projectId } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_DATASETS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify project exists and belongs to the organization
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId),
    ),
  });

  if (!project) {
    return {
      status: 400,
      body: {
        message: 'Project not found or does not belong to your organization',
        errorCode: 'validation',
      },
    };
  }

  const [dataset] = await db
    .insert(datasets)
    .values({
      name,
      description,
      projectId,
      organizationId,
    })
    .returning();

  return {
    status: 201,
    body: {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      organizationId: dataset.organizationId,
      projectId: dataset.projectId,
      createdAt: dataset.createdAt.toISOString(),
      updatedAt: dataset.updatedAt.toISOString(),
    },
  };
}

type UpdateDatasetRequest = ServerInferRequest<
  typeof contracts.dataset.updateDataset
>;
type UpdateDatasetResponse = ServerInferResponses<
  typeof contracts.dataset.updateDataset
>;

export async function updateDataset(
  req: UpdateDatasetRequest,
): Promise<UpdateDatasetResponse> {
  const { datasetId } = req.params;
  const { name, description } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_DATASETS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify dataset exists and belongs to the organization
  const existingDataset = await db.query.datasets.findFirst({
    where: and(
      eq(datasets.id, datasetId),
      eq(datasets.organizationId, organizationId),
    ),
  });

  if (!existingDataset) {
    return {
      status: 404,
      body: {
        message: 'Dataset not found',
      },
    };
  }

  const [updatedDataset] = await db
    .update(datasets)
    .set({
      name,
      description,
    })
    .where(
      and(
        eq(datasets.id, datasetId),
        eq(datasets.organizationId, organizationId),
      ),
    )
    .returning();

  return {
    status: 200,
    body: {
      id: updatedDataset.id,
      name: updatedDataset.name,
      description: updatedDataset.description,
      organizationId: updatedDataset.organizationId,
      projectId: updatedDataset.projectId,
      createdAt: updatedDataset.createdAt.toISOString(),
      updatedAt: updatedDataset.updatedAt.toISOString(),
    },
  };
}

type GetDatasetsRequest = ServerInferRequest<
  typeof contracts.dataset.getDatasets
>;
type GetDatasetsResponse = ServerInferResponses<
  typeof contracts.dataset.getDatasets
>;

export async function getDatasets(
  req: GetDatasetsRequest,
): Promise<GetDatasetsResponse> {
  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_DATASETS)) {
    return {
      status: 403,
      body: null,
    };
  }

  const { offset, limit = 10, search, projectId } = req.query;

  const where = [eq(datasets.organizationId, organizationId)];

  if (projectId) {
    where.push(eq(datasets.projectId, projectId));
  }

  if (search) {
    where.push(ilike(datasets.name, `%${search}%`));
  }

  const datasetResults = await db.query.datasets.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
    orderBy: (datasets, { desc }) => [desc(datasets.createdAt)],
  });

  return {
    status: 200,
    body: {
      datasets: datasetResults.slice(0, limit).map((dataset) => ({
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
        organizationId: dataset.organizationId,
        projectId: dataset.projectId,
        createdAt: dataset.createdAt.toISOString(),
        updatedAt: dataset.updatedAt.toISOString(),
      })),
      hasNextPage: datasetResults.length > limit,
    },
  };
}

type GetDatasetRequest = ServerInferRequest<
  typeof contracts.dataset.getDataset
>;
type GetDatasetResponse = ServerInferResponses<
  typeof contracts.dataset.getDataset
>;

export async function getDataset(
  req: GetDatasetRequest,
): Promise<GetDatasetResponse> {
  const { datasetId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_DATASETS)) {
    return {
      status: 403,
      body: null,
    };
  }

  const dataset = await db.query.datasets.findFirst({
    where: and(
      eq(datasets.id, datasetId),
      eq(datasets.organizationId, organizationId),
    ),
  });

  if (!dataset) {
    return {
      status: 404,
      body: {
        message: 'Dataset not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      organizationId: dataset.organizationId,
      projectId: dataset.projectId,
      createdAt: dataset.createdAt.toISOString(),
      updatedAt: dataset.updatedAt.toISOString(),
    },
  };
}

type DeleteDatasetRequest = ServerInferRequest<
  typeof contracts.dataset.deleteDataset
>;
type DeleteDatasetResponse = ServerInferResponses<
  typeof contracts.dataset.deleteDataset
>;

export async function deleteDataset(
  req: DeleteDatasetRequest,
): Promise<DeleteDatasetResponse> {
  const { datasetId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.DELETE_DATASETS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify dataset exists and belongs to the organization
  const existingDataset = await db.query.datasets.findFirst({
    where: and(
      eq(datasets.id, datasetId),
      eq(datasets.organizationId, organizationId),
    ),
  });

  if (!existingDataset) {
    return {
      status: 404,
      body: {
        message: 'Dataset not found',
      },
    };
  }

  await db
    .delete(datasets)
    .where(
      and(
        eq(datasets.id, datasetId),
        eq(datasets.organizationId, organizationId),
      ),
    );

  return {
    status: 204,
    body: null,
  };
}

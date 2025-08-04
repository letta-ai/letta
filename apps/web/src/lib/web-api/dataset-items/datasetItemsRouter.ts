import { db, datasetItems, datasets } from '@letta-cloud/service-database';
import { getUserWithActiveOrganizationIdOrThrow } from '$web/server/auth';
import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { and, eq } from 'drizzle-orm';
import { ApplicationServices } from '@letta-cloud/service-rbac';

type GetDatasetItemsRequest = ServerInferRequest<
  typeof contracts.datasetItems.getDatasetItems
>;
type GetDatasetItemsResponse = ServerInferResponses<
  typeof contracts.datasetItems.getDatasetItems
>;

export async function getDatasetItems(
  req: GetDatasetItemsRequest,
): Promise<GetDatasetItemsResponse> {
  const { datasetId } = req.params;
  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_DATASET_ITEMS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify dataset exists and belongs to the organization
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

  const { offset = 0, limit = 10 } = req.query;

  const items = await db.query.datasetItems.findMany({
    where: eq(datasetItems.datasetId, datasetId),
    offset,
    limit: limit + 1,
    orderBy: (datasetItems, { desc }) => [desc(datasetItems.createdAt)],
  });

  return {
    status: 200,
    body: {
      datasetItems: items.slice(0, limit).map((item) => ({
        id: item.id,
        datasetId: item.datasetId,
        createMessage: item.createMessage,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      hasNextPage: items.length > limit,
    },
  };
}

type GetDatasetItemRequest = ServerInferRequest<
  typeof contracts.datasetItems.getDatasetItem
>;
type GetDatasetItemResponse = ServerInferResponses<
  typeof contracts.datasetItems.getDatasetItem
>;

export async function getDatasetItem(
  req: GetDatasetItemRequest,
): Promise<GetDatasetItemResponse> {
  const { datasetId, datasetItemId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.READ_DATASET_ITEMS)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify dataset exists and belongs to the organization
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

  const datasetItem = await db.query.datasetItems.findFirst({
    where: and(
      eq(datasetItems.id, datasetItemId),
      eq(datasetItems.datasetId, datasetId),
    ),
  });

  if (!datasetItem) {
    return {
      status: 404,
      body: {
        message: 'Dataset item not found',
      },
    };
  }

  return {
    status: 200,
    body: {
      id: datasetItem.id,
      datasetId: datasetItem.datasetId,
      createMessage: datasetItem.createMessage,
      createdAt: datasetItem.createdAt.toISOString(),
      updatedAt: datasetItem.updatedAt.toISOString(),
    },
  };
}

type UpdateDatasetItemRequest = ServerInferRequest<
  typeof contracts.datasetItems.updateDatasetItem
>;
type UpdateDatasetItemResponse = ServerInferResponses<
  typeof contracts.datasetItems.updateDatasetItem
>;

export async function updateDatasetItem(
  req: UpdateDatasetItemRequest,
): Promise<UpdateDatasetItemResponse> {
  const { datasetId, datasetItemId } = req.params;
  const { createMessage } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.UPDATE_DATASET_ITEM)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify dataset exists and belongs to the organization
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

  // Verify dataset item exists
  const existingItem = await db.query.datasetItems.findFirst({
    where: and(
      eq(datasetItems.id, datasetItemId),
      eq(datasetItems.datasetId, datasetId),
    ),
  });

  if (!existingItem) {
    return {
      status: 404,
      body: {
        message: 'Dataset item not found',
      },
    };
  }

  try {
    const [updatedItem] = await db
      .update(datasetItems)
      .set({
        createMessage: createMessage,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(datasetItems.id, datasetItemId),
          eq(datasetItems.datasetId, datasetId),
        ),
      )
      .returning();

    return {
      status: 200,
      body: {
        id: updatedItem.id,
        datasetId: updatedItem.datasetId,
        createMessage: updatedItem.createMessage,
        createdAt: updatedItem.createdAt.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
      },
    };
  } catch (_error) {
    return {
      status: 400,
      body: {
        message: 'Failed to update dataset item',
        errorCode: 'default' as const,
      },
    };
  }
}

type DeleteDatasetItemRequest = ServerInferRequest<
  typeof contracts.datasetItems.deleteDatasetItem
>;
type DeleteDatasetItemResponse = ServerInferResponses<
  typeof contracts.datasetItems.deleteDatasetItem
>;

export async function deleteDatasetItem(
  req: DeleteDatasetItemRequest,
): Promise<DeleteDatasetItemResponse> {
  const { datasetId, datasetItemId } = req.params;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.DELETE_DATASET_ITEM)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify dataset exists and belongs to the organization
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

  // Verify dataset item exists
  const existingItem = await db.query.datasetItems.findFirst({
    where: and(
      eq(datasetItems.id, datasetItemId),
      eq(datasetItems.datasetId, datasetId),
    ),
  });

  if (!existingItem) {
    return {
      status: 404,
      body: {
        message: 'Dataset item not found',
      },
    };
  }

  await db
    .delete(datasetItems)
    .where(
      and(
        eq(datasetItems.id, datasetItemId),
        eq(datasetItems.datasetId, datasetId),
      ),
    );

  return {
    status: 204,
    body: null,
  };
}

type UpsertDatasetItemPayload = ServerInferRequest<
  typeof contracts.datasetItems.upsertDatasetItem
>;
type UpsertDatasetItemResponse = ServerInferResponses<
  typeof contracts.datasetItems.upsertDatasetItem
>;

export async function upsertDatasetItem(
  req: UpsertDatasetItemPayload,
): Promise<UpsertDatasetItemResponse> {
  const { datasetId } = req.params;
  const { createMessage } = req.body;

  const { activeOrganizationId: organizationId, permissions } =
    await getUserWithActiveOrganizationIdOrThrow();

  if (!permissions.has(ApplicationServices.CREATE_DATASET_ITEM)) {
    return {
      status: 403,
      body: null,
    };
  }

  // Verify dataset exists and belongs to the organization
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

  try {
    // Get all items in the dataset to check for duplicates
    const existingItems = await db.query.datasetItems.findMany({
      where: eq(datasetItems.datasetId, datasetId),
    });

    const newContentNormalized = JSON.stringify(createMessage);

    const existingItem = existingItems.find(
      (item) => JSON.stringify(item.createMessage) === newContentNormalized,
    );

    if (existingItem) {
      // Update existing item
      const [updatedItem] = await db
        .update(datasetItems)
        .set({
          createMessage: createMessage,
          updatedAt: new Date(),
        })
        .where(eq(datasetItems.id, existingItem.id))
        .returning();

      return {
        status: 200,
        body: {
          id: updatedItem.id,
          datasetId: updatedItem.datasetId,
          createMessage: updatedItem.createMessage,
          createdAt: updatedItem.createdAt.toISOString(),
          updatedAt: updatedItem.updatedAt.toISOString(),
        },
      };
    } else {
      // Create new item
      const [newDatasetItem] = await db
        .insert(datasetItems)
        .values({
          datasetId,
          createMessage: createMessage,
          createdAt: new Date(),
        })
        .returning();

      return {
        status: 201,
        body: {
          id: newDatasetItem.id,
          datasetId: newDatasetItem.datasetId,
          createMessage: newDatasetItem.createMessage,
          createdAt: newDatasetItem.createdAt.toISOString(),
          updatedAt: newDatasetItem.updatedAt.toISOString(),
        },
      };
    }
  } catch (_error) {
    return {
      status: 400,
      body: {
        message: 'Failed to upsert dataset item',
        errorCode: 'default' as const,
      },
    };
  }
}

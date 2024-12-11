import type { ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$letta/web-api/contracts';
import { db, toolMetadata } from '@letta-web/database';
import { and, count, eq, like, sql } from 'drizzle-orm';

type ListToolMetadataRequest = ServerInferRequest<typeof contracts.toolMetadata.listToolMetadata>;
type ListToolMetadataResponse = ServerInferResponses<typeof contracts.toolMetadata.listToolMetadata>;

async function listToolMetadata(req: ListToolMetadataRequest): Promise<ListToolMetadataResponse> {
  const { search, tags, brand, offset, limit = 10 } = req.query

  const where = [];

  if (search) {
    where.push(like(toolMetadata.name, `%${search}%`));
  }

  if (tags) {
    tags.forEach(tag => {
      where.push(like(toolMetadata.tags, `%${tag}%`));
    })
  }

  if (brand) {
    where.push(eq(toolMetadata.brand, brand));
  }

  const toolMetaData = await db.query.toolMetadata.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
  });

  return {
    status: 200,
    body: {
      toolMetadata: toolMetaData.map(t => ({
          name: t.name,
          description: t.description,
          id: t.id,
          brand: t.brand,
          imageUrl: t.configuration?.type === 'composio' ? t.configuration.logo : null,
          provider: t.provider,
        })).slice(0, limit),
        hasNextPage: toolMetaData.length > limit,
    }
  }
}

type GetToolMetadataSummaryResponse = ServerInferResponses<typeof contracts.toolMetadata.getToolMetadataSummary>;

async function getToolMetadataSummary(): Promise<GetToolMetadataSummaryResponse> {
  const [result, [{  count: allToolsCount  }]] = await Promise.all([
    db.execute(sql`SELECT brand, COUNT(*) FROM tool_metadata GROUP BY brand`),
    db.select({ count: count() }).from(toolMetadata),
  ]);

  const toolCountByBrand = result.reduce((acc, r) => {
    try {
      acc[r.brand as string] = parseInt(`${r.count}`, 10);
    } catch (_) {
      acc[r.brand as string] = 0;
    }

    return acc;
  }, {}) as Record<string, number>;

  return {
    status: 200,
    body: {
      allToolsCount,
      toolCountByBrand,
    }
  }
}

type ListToolGroupsRequest = ServerInferRequest<typeof contracts.toolMetadata.listToolGroupMetadata>;
type ListToolGroupsResponse = ServerInferResponses<typeof contracts.toolMetadata.listToolGroupMetadata>;

async function listToolGroupMetadata(req: ListToolGroupsRequest): Promise<ListToolGroupsResponse> {
  const { search, offset, limit = 10 } = req.query;

  const where = [];

  if (search) {
    where.push(like(toolMetadata.brand, `%${search}%`));
  }

  const toolGroups = await db.query.toolGroupMetadata.findMany({
    where: and(...where),
    offset,
    limit: limit + 1,
  });

  const result = await db.execute(sql`SELECT brand, COUNT(*) FROM tool_metadata GROUP BY brand`)

  const map = new Map(result.map(r => {
    try {
      return [r.brand, parseInt(`${r.count}`, 10)]
    } catch (_) {
      return [r.brand, 0]
    }
  }));

  return {
    status: 200,
    body: {
      toolGroups: toolGroups.map(t => ({
        brand: t.brand,
        description: t.description,
        imageUrl: t.imageUrl || '',
        toolCount: map.get(t.brand) || 0,
      })).slice(0, limit),
      hasNextPage: toolGroups.length > limit,
    }
  }
}

type GetSingleToolMetadataRequest = ServerInferRequest<typeof contracts.toolMetadata.getSingleToolMetadata>;
type GetSingleToolMetadataResponse = ServerInferResponses<typeof contracts.toolMetadata.getSingleToolMetadata>;

async function getSingleToolMetadata(req: GetSingleToolMetadataRequest): Promise<GetSingleToolMetadataResponse> {
  const { id } = req.params;

  const toolMetadataResponse = await db.query.toolMetadata.findFirst({
    where: eq(toolMetadata.id, id),
  });

  if (!toolMetadataResponse) {
    return {
      status: 404,
      body: {
        message: 'Tool not found',
      }
    }
  }

  return {
    status: 200,
    body: {
      configuration: toolMetadataResponse.configuration,
      providerId: toolMetadataResponse.providerId,
      name: toolMetadataResponse.name,
      description: toolMetadataResponse.description,
      id: toolMetadataResponse.id,
      brand: toolMetadataResponse.brand,
      provider: toolMetadataResponse.provider,
    }
  }
}




export const toolMetadataRouter = {
  listToolMetadata,
  getToolMetadataSummary,
  listToolGroupMetadata,
  getSingleToolMetadata,
}

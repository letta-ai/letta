import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '$web/web-api/contracts';
import { getAllToolsFromComposio } from '@letta-cloud/composio';
import { db, toolGroupMetadata, toolMetadata } from '@letta-cloud/database';
import { and, eq, inArray } from 'drizzle-orm';

type SyncToolsWithComposioContractResponse = ServerInferResponses<
  typeof contracts.admin.toolMetadata.syncToolsWithComposio
>;

function toProperSentenceCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function mapAppIdToBrand(appId: string) {
  const overwriteMap: Record<string, string> = {
    discordbot: 'discord',
    twitter_media: 'twitter',
    gmail_beta: 'gmail',
  };

  return overwriteMap[appId] || appId;
}

async function syncToolsWithComposio(): Promise<SyncToolsWithComposioContractResponse> {
  const composioTools = await getAllToolsFromComposio();

  const existingTools = await db.query.toolMetadata.findMany({
    where: and(
      eq(toolMetadata.provider, 'composio'),
      inArray(
        toolMetadata.providerId,
        composioTools.map((t) => t.enum),
      ),
    ),
  });

  const composioToolMap = new Map(composioTools.map((t) => [t.enum, t]));
  const existingToolMap = new Map(existingTools.map((t) => [t.providerId, t]));

  const uniqueBrands = new Set<string>();
  const uniqueBrandsToImage = new Map<string, string>();

  const newTools = composioTools.filter((t) => !existingToolMap.has(t.enum));

  await Promise.all(
    existingTools.map((t) => {
      const composioTool = composioToolMap.get(t.providerId);

      if (!composioTool) {
        return;
      }

      const brand = mapAppIdToBrand(composioTool.appId);

      uniqueBrands.add(brand);
      uniqueBrandsToImage.set(brand, composioTool.logo);

      return db
        .update(toolMetadata)
        .set({
          name: composioTool.displayName,
          description: toProperSentenceCase(composioTool.description),
          tags: composioTool.tags.join(','),
          brand,
          configuration: {
            type: 'composio',
            name: composioTool.name,
            enum: composioTool.enum,
            logo: composioTool.logo,
            displayName: composioTool.displayName,
            appId: composioTool.appId,
            tags: composioTool.tags,
          },
          provider: 'composio',
          providerId: composioTool.enum,
        })
        .where(eq(toolMetadata.id, t.id));
    }),
  );

  await Promise.all(
    newTools.map((t) => {
      uniqueBrands.add(t.appId);
      const brand = mapAppIdToBrand(t.appId);

      return db.insert(toolMetadata).values({
        name: t.displayName,
        description: toProperSentenceCase(t.description),
        tags: t.tags.join(','),
        brand,
        configuration: {
          type: 'composio',
          name: t.name,
          enum: t.enum,
          logo: t.logo,
          displayName: t.displayName,
          appId: t.appId,
          tags: t.tags,
        },
        provider: 'composio',
        providerId: t.enum,
      });
    }),
  );

  const existingUniqueBrands = await db.query.toolGroupMetadata.findMany({
    where: inArray(toolGroupMetadata.brand, Array.from(uniqueBrands)),
  });

  const existingBrandSet = new Set(existingUniqueBrands.map((v) => v.brand));

  const newBrands = Array.from(uniqueBrands).filter(
    (v) => !existingBrandSet.has(v),
  );

  await Promise.all(
    newBrands.map((brand) => {
      return db.insert(toolGroupMetadata).values({
        brand,
        description: '',
        imageUrl: uniqueBrandsToImage.get(brand) || '',
      });
    }),
  );

  await Promise.all(
    existingUniqueBrands.map((brand) => {
      return db
        .update(toolGroupMetadata)
        .set({
          imageUrl: uniqueBrandsToImage.get(brand.brand),
        })
        .where(eq(toolGroupMetadata.brand, brand.brand));
    }),
  );

  return {
    status: 200,
    body: {
      success: true,
    },
  };
}

export const adminToolMetadataRouter = {
  syncToolsWithComposio,
};

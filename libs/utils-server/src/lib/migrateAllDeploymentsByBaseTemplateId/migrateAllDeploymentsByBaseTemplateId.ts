import { migrateDeploymentEntities } from '../migrateDeploymentEntities/migrateDeploymentEntities';
import { db, deployment, lettaTemplates } from '@letta-cloud/service-database';
import { eq, and, count } from 'drizzle-orm';

interface MigrateAllDeploymentsByBaseTemplateIdOptions {
  baseTemplateId: string;
  organizationId: string;
  lettaAgentsUserId: string;
  preserveCoreMemories?: boolean;
  preserveToolVariables?: boolean;
  memoryVariables?: Record<string, string>;
  batchSize?: number;
}

interface BatchMigrationResult {
  totalDeployments: number;
  successfulMigrations: number;
  failedMigrations: number;
  errors: Array<{ deploymentId: string; error: string }>;
}

export async function migrateAllDeploymentsByBaseTemplateId(
  options: MigrateAllDeploymentsByBaseTemplateIdOptions,
): Promise<BatchMigrationResult> {
  const {
    baseTemplateId,
    organizationId,
    lettaAgentsUserId,
    preserveCoreMemories = false,
    preserveToolVariables = false,
    memoryVariables = {},
    batchSize = 10,
  } = options;

  // Get the current template version for the given baseTemplateId
  const currentTemplate = await db.query.lettaTemplates.findFirst({
    where: and(
      eq(lettaTemplates.id, baseTemplateId),
      eq(lettaTemplates.version, 'current'),
    ),
  });

  if (!currentTemplate) {
    throw new Error(
      `Current template not found for baseTemplateId: ${baseTemplateId}`,
    );
  }

  // Get initial deployment info to check total count
  const initialBatch = await getDeploymentsForBaseTemplate({
    baseTemplateId,
    organizationId,
    batchSize: 1,
    offset: 0,
  });

  const totalDeployments = initialBatch.totalCount;
  let successfulMigrations = 0;
  let failedMigrations = 0;
  const errors: Array<{ deploymentId: string; error: string }> = [];

  if (totalDeployments === 0) {
    return {
      totalDeployments: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      errors: [],
    };
  }

  // Process deployments in batches using the reusable function
  let offset = 0;

  while (offset < totalDeployments) {
    // Fetch batch of deployments using the reusable function
    const batchResult = await getDeploymentsForBaseTemplate({
      baseTemplateId,
      organizationId,
      batchSize,
      offset,
    });

    const batchPromises = batchResult.deployments.map(async (deployment) => {
      try {
        await migrateDeploymentEntities({
          deploymentId: deployment.id,
          templateId: currentTemplate.id,
          organizationId,
          lettaAgentsUserId,
          preserveCoreMemories,
          preserveToolVariables,
          memoryVariables,
          baseTemplateId,
        });
        return {
          success: true as const,
          deploymentId: deployment.id
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false as const,
          deploymentId: deployment.id,
          error: errorMessage,
        };
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successfulMigrations++;
        } else {
          failedMigrations++;
          errors.push({
            deploymentId: result.value.deploymentId,
            error: result.value.error,
          });
        }
      } else {
        failedMigrations++;
        errors.push({
          deploymentId: batchResult.deployments[index].id,
          error: result.reason?.toString() || 'Promise rejection',
        });
      }
    });

    // Move to next batch
    offset += batchSize;
  }

  return {
    totalDeployments,
    successfulMigrations,
    failedMigrations,
    errors,
  };
}

export async function getDeploymentsForBaseTemplate(options: {
  baseTemplateId: string;
  organizationId: string;
  batchSize?: number;
  offset?: number;
}): Promise<{
  deployments: Array<{ id: string }>;
  totalCount: number;
  hasMore: boolean;
}> {
  const { baseTemplateId, organizationId, batchSize = 10, offset = 0 } = options;

  // Get total count
  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(deployment)
    .where(
      and(
        eq(deployment.baseTemplateId, baseTemplateId),
        eq(deployment.organizationId, organizationId),
      ),
    );

  // Get deployments for this batch
  const deployments = await db.query.deployment.findMany({
    where: and(
      eq(deployment.baseTemplateId, baseTemplateId),
      eq(deployment.organizationId, organizationId),
    ),
    columns: {
      id: true,
    },
    limit: batchSize,
    offset: offset,
  });

  return {
    deployments,
    totalCount,
    hasMore: offset + batchSize < totalCount,
  };
}

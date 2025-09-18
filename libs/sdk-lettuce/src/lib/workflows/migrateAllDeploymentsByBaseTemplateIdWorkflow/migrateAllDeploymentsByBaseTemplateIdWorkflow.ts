import { proxyActivities, isCancellation, startChild } from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { MigrateAllDeploymentsByBaseTemplateIdPayload, MigrateDeploymentEntitiesPayload } from '../../types';
import { migrateDeploymentEntitiesWorkflow } from '../migrateDeploymentEntitiesWorkflow/migrateDeploymentEntitiesWorkflow';

// Activity for getting deployment information and template details
const { getDeploymentsForBaseTemplateActivity, getCurrentTemplateActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5 seconds',
    maximumInterval: '60 seconds',
    backoffCoefficient: 2,
  },
});

export async function migrateAllDeploymentsByBaseTemplateIdWorkflow(
  payload: MigrateAllDeploymentsByBaseTemplateIdPayload,
) {
  const {
    baseTemplateId,
    organizationId,
    lettaAgentsId,
    preserveCoreMemories = false,
    preserveToolVariables = false,
    memoryVariables = {},
    batchSize = 10,
  } = payload;

  try {
    console.log(
      `Starting batch deployment migration for base template ${baseTemplateId} in organization ${organizationId}`,
    );

    // Get the current template version for the given baseTemplateId
    const currentTemplate = await getCurrentTemplateActivity({ baseTemplateId });

    let offset = 0;
    let totalDeployments = 0;
    let successfulMigrations = 0;
    let failedMigrations = 0;
    const errors: Array<{ deploymentId: string; error: string }> = [];

    // Process deployments in batches
    while (true) {
      // Get batch of deployments
      const batchInfo = await getDeploymentsForBaseTemplateActivity({
        baseTemplateId,
        organizationId,
        batchSize,
        offset,
      });

      if (offset === 0) {
        totalDeployments = batchInfo.totalCount;
        if (totalDeployments === 0) {
          console.log('No deployments found for base template');
          break;
        }
      }

      const { deployments, hasMore } = batchInfo;

      // Start child workflows for each deployment in the batch
      const childWorkflowPromises = deployments.map(async (deployment) => {
        const childWorkflowId = `migrate-deployment-${deployment.id}-${Date.now()}`;

        try {
          const childPayload: MigrateDeploymentEntitiesPayload = {
            deploymentId: deployment.id,
            templateId: currentTemplate.id,
            organizationId,
            lettaAgentsId,
            preserveCoreMemories,
            preserveToolVariables,
            memoryVariables,
            baseTemplateId,
          };

          await startChild(migrateDeploymentEntitiesWorkflow, {
            workflowId: childWorkflowId,
            args: [childPayload],
            workflowRunTimeout: '30 minutes',
            retry: {
              maximumAttempts: 3,
              initialInterval: '5 seconds',
              maximumInterval: '60 seconds',
              backoffCoefficient: 2,
            },
          });

          return { success: true, deploymentId: deployment.id };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          return {
            success: false,
            deploymentId: deployment.id,
            error: errorMessage,
          };
        }
      });

      // Wait for all child workflows in this batch to complete
      const batchResults = await Promise.allSettled(childWorkflowPromises);

      // Process results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successfulMigrations++;
          } else {
            failedMigrations++;
            errors.push({
              deploymentId: result.value.deploymentId,
              error: result.value.error || 'Unknown error',
            });
          }
        } else {
          failedMigrations++;
          errors.push({
            deploymentId: deployments[index].id,
            error: result.reason?.toString() || 'Promise rejection',
          });
        }
      });

      console.log(
        `Processed batch: ${successfulMigrations + failedMigrations}/${totalDeployments} deployments`,
      );

      if (!hasMore) {
        break;
      }

      offset += batchSize;
    }

    const result = {
      totalDeployments,
      successfulMigrations,
      failedMigrations,
      errors,
    };

    console.log(
      `Batch deployment migration completed: ${result.successfulMigrations}/${result.totalDeployments} successful`,
    );

    return result;
  } catch (error) {
    if (isCancellation(error)) {
      console.warn('migrateAllDeploymentsByBaseTemplateIdWorkflow was canceled:', error);
    } else {
      console.error(
        `Batch deployment migration failed for base template ${baseTemplateId}:`,
        error,
      );
    }
    throw error;
  }
}

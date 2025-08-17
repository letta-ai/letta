import {
  proxyActivities,
  isCancellation,
  startChild,
} from '@temporalio/workflow';
import type { activities } from '../../activities';
import type {
  MigrateTemplateEntitiesPayload,
  MigrateBatchPayload,
  MigrateBatchResult,
} from '../../types';

const { getTemplateByName, getAgentsFromTemplate } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    maximumInterval: '30 seconds',
    backoffCoefficient: 2,
  },
});

export async function migrateTemplateEntitiesWorkflow(
  payload: MigrateTemplateEntitiesPayload,
): Promise<{ successful: number; failed: number; total: number }> {
  const {
    preserveToolVariables,
    versionString,
    preserveCoreMemories,
    organizationId,
    lettaAgentsId,
    batchSize = 25,
  } = payload;

  try {
    console.log(
      `Starting template entities migration for version ${versionString}`,
    );

    // Get template information
    const template = await getTemplateByName({
      versionString,
      organizationId,
      lettaAgentsId,
    });

    if (!template) {
      throw new Error(
        `Template ${versionString} not found for organization ${organizationId}`,
      );
    }

    if (template.type !== 'classic') {
      throw new Error(
        `Migration for template type ${template.type} is not implemented`,
      );
    }

    console.log(
      `Starting batched migration to version ${versionString} (batch size: ${batchSize})`,
    );

    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalProcessed = 0;
    let after: string | undefined = undefined;
    let batchNumber = 1;
    let hasMore = true;
    const allFailedAgentIds: string[] = [];

    // Process agents in batches using batch workflows
    while (hasMore) {
      console.log(
        `Getting batch ${batchNumber} (after: ${after || 'start'}, batch size: ${batchSize})`,
      );

      // Get the next batch of agents
      const batchResult = await getAgentsFromTemplate({
        templateId: template.id,
        organizationId,
        lettaAgentsId,
        limit: batchSize,
        after,
      });

      const { agents, hasMore: hasMoreAgents, nextCursor } = batchResult;
      hasMore = hasMoreAgents;

      if (agents.length === 0) {
        console.log(`No agents found in batch ${batchNumber}, stopping`);
        break;
      }

      console.log(
        `Starting batch workflow ${batchNumber} with ${agents.length} agents`,
      );
      totalProcessed += agents.length;

      // Create batch payload
      const batchPayload: MigrateBatchPayload = {
        agents,
        preserveToolVariables,
        preserveCoreMemories,
        versionString,
        organizationId,
        lettaAgentsId,
        batchNumber,
      };

      try {
        // Start batch workflow as child workflow
        const batchHandle = await startChild('migrateBatchWorkflow', {
          args: [batchPayload],
          workflowId: `migrate-batch-${batchNumber}-${Date.now()}`,
        });

        const batchResult: MigrateBatchResult = await batchHandle.result();

        totalSuccessful += batchResult.successful;
        totalFailed += batchResult.failed;
        allFailedAgentIds.push(...batchResult.failedAgentIds);

        console.log(
          `Batch ${batchNumber} completed: ${batchResult.successful} successful, ${batchResult.failed} failed. Total processed so far: ${totalProcessed}`,
        );
      } catch (error) {
        console.error(`Batch workflow ${batchNumber} failed:`, error);
        totalFailed += agents.length; // Count all agents in failed batch as failed
        allFailedAgentIds.push(...agents.map((agent) => agent.agentId));
      }

      // Prepare for next batch
      after = nextCursor;
      batchNumber++;
    }

    console.log(
      `Template entities migration completed: ${totalSuccessful} successful, ${totalFailed} failed out of ${totalProcessed} total processed. Failed agent IDs: ${allFailedAgentIds.length > 0 ? allFailedAgentIds.join(', ') : 'none'}`,
    );

    return {
      successful: totalSuccessful,
      failed: totalFailed,
      total: totalProcessed,
    };
  } catch (error) {
    if (isCancellation(error)) {
      console.warn('migrateTemplateEntitiesWorkflow was canceled:', error);
      // Child workflows will be automatically canceled
    }
    throw error;
  }
}

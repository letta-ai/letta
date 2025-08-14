import {
  proxyActivities,
  isCancellation,
  startChild,
} from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { MigrateAgentsPayload, MigrateAgentPayload } from '../../types';
import type {
  MigrateAgentsBatchPayload,
  MigrateAgentsBatchResult,
} from '../migrateAgentsBatchWorkflow/migrateAgentsBatchWorkflow';

const { getAgentsByIds } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 hour',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
  },
});

// Default configuration constants
const DEFAULT_AGENT_FETCH_BATCH_SIZE = 25; // Number of agents to fetch per API call
const DEFAULT_WORKFLOW_BATCH_SIZE = 10; // Number of agents to process concurrently
const DEFAULT_MAX_RETRIES = 3; // Maximum retries for failed batches

export async function migrateAgentsWorkflow(
  payload: MigrateAgentsPayload,
): Promise<{ successful: number; failed: number; total: number }> {
  const {
    memoryVariables,
    agentIds: specificAgentIds,
    organizationId,
    template,
    preserveCoreMemories,
    preserveToolVariables,
    coreUserId,
    batchConfig = {},
  } = payload;

  // Use configured batch sizes or defaults
  const agentFetchBatchSize =
    batchConfig.agentFetchBatchSize ?? DEFAULT_AGENT_FETCH_BATCH_SIZE;
  const workflowBatchSize =
    batchConfig.workflowBatchSize ?? DEFAULT_WORKFLOW_BATCH_SIZE;
  const maxRetries = batchConfig.maxRetries ?? DEFAULT_MAX_RETRIES;

  try {
    // Handle specific agent IDs differently - they don't need batched fetching
    if (specificAgentIds) {
      const agents = await getAgentsByIds(specificAgentIds);

      if (agents.length === 0) {
        console.log('No agents found to migrate');
        return { successful: 0, failed: 0, total: 0 };
      }

      console.log(
        `Starting migration of ${agents.length} specific agents to template ${template}`,
      );

      return await processSpecificAgents(
        agents,
        template,
        organizationId,
        coreUserId,
        memoryVariables,
        preserveCoreMemories,
        preserveToolVariables,
        workflowBatchSize,
      );
    }

    // For template-based migrations, use batch child workflows
    console.log(`Starting batched migration for template ${template}`);

    // Process batches sequentially (parallel processing can be added later if needed)
    return await processSequentially(
      template,
      organizationId,
      coreUserId,
      undefined, // cursor starts as undefined
      agentFetchBatchSize,
      workflowBatchSize,
      maxRetries,
      memoryVariables,
      preserveCoreMemories,
      preserveToolVariables,
    );
  } catch (err) {
    if (isCancellation(err)) {
      console.warn('migrateAgentsWorkflow was canceled:', err);
    }
    throw err;
  }
}

// eslint-disable-next-line @typescript-eslint/max-params
async function processSpecificAgents(
  agents: Array<{ agentId: string; variables: Record<string, string> }>,
  template: string,
  organizationId: string,
  coreUserId: string,
  memoryVariables?: Record<string, string>,
  preserveCoreMemories?: boolean,
  preserveToolVariables?: boolean,
  workflowBatchSize: number = DEFAULT_WORKFLOW_BATCH_SIZE,
): Promise<{ successful: number; failed: number; total: number }> {
  let successful = 0;
  let failed = 0;

  // Process agents in smaller workflow batches to avoid overwhelming Temporal
  for (let i = 0; i < agents.length; i += workflowBatchSize) {
    const batch = agents.slice(i, i + workflowBatchSize);

    console.log(
      `Processing workflow batch ${Math.floor(i / workflowBatchSize) + 1}/${Math.ceil(agents.length / workflowBatchSize)}: agents ${i + 1}-${Math.min(i + workflowBatchSize, agents.length)} of ${agents.length}`,
    );

    // Start individual agent migration workflows for this batch
    const batchHandles = batch.map(async (agent, batchIndex) => {
      const globalIndex = i + batchIndex;
      const agentPayload: MigrateAgentPayload = {
        memoryVariables: memoryVariables || agent.variables,
        preserveCoreMemories,
        preserveToolVariables,
        agentId: agent.agentId,
        template,
        coreUserId,
        organizationId,
      };

      try {
        const handle = await startChild('migrateAgentWorkflow', {
          args: [agentPayload],
          workflowId: `migrate-agent-${agent.agentId}-${Date.now()}-${globalIndex}`,
        });

        const result = await handle.result();
        return { agentId: agent.agentId, success: result };
      } catch (err) {
        console.error(`Failed to migrate agent ${agent.agentId}:`, err);
        return { agentId: agent.agentId, success: false, error: err };
      }
    });

    // Wait for this workflow batch to complete
    const batchResults = await Promise.allSettled(batchHandles);

    // Process batch results
    let batchSuccessful = 0;
    let batchFailed = 0;

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        batchSuccessful++;
        successful++;
      } else {
        batchFailed++;
        failed++;
        if (result.status === 'rejected') {
          console.error('Child workflow failed:', result.reason);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          console.error(
            `Agent migration failed for ${result.value.agentId}:`,
            (result.value as any).error,
          );
        }
      }
    }

    console.log(
      `Workflow batch ${Math.floor(i / workflowBatchSize) + 1} completed: ${batchSuccessful} successful, ${batchFailed} failed`,
    );
  }

  return { successful, failed, total: agents.length };
}

// eslint-disable-next-line @typescript-eslint/max-params
async function processSequentially(
  template: string,
  organizationId: string,
  coreUserId: string,
  cursor: string | undefined,
  agentFetchBatchSize: number,
  workflowBatchSize: number,
  maxRetries: number,
  memoryVariables?: Record<string, string>,
  preserveCoreMemories?: boolean,
  preserveToolVariables?: boolean,
): Promise<{ successful: number; failed: number; total: number }> {
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalProcessed = 0;
  let batchNumber = 1;

  do {
    try {
      console.log(
        `Starting batch ${batchNumber} with cursor: ${cursor || 'initial'}`,
      );

      const batchPayload: MigrateAgentsBatchPayload = {
        template,
        organizationId,
        coreUserId,
        cursor,
        batchSize: agentFetchBatchSize,
        workflowBatchSize,
        memoryVariables,
        preserveCoreMemories,
        preserveToolVariables,
        batchNumber,
        globalOffset: totalProcessed,
      };

      // Start batch processing child workflow
      const batchHandle = await startChild('migrateAgentsBatchWorkflow', {
        args: [batchPayload],
        workflowId: `migrate-batch-${template.replace(':', '-')}-${batchNumber}-${Date.now()}`,
        retry: {
          maximumAttempts: maxRetries + 1,
          initialInterval: '5 seconds',
          maximumInterval: '2 minutes',
          backoffCoefficient: 2,
        },
      });

      const batchResult: MigrateAgentsBatchResult = await batchHandle.result();

      totalSuccessful += batchResult.successful;
      totalFailed += batchResult.failed;
      totalProcessed += batchResult.processed;

      console.log(
        `Batch ${batchNumber} completed: ${batchResult.successful}/${batchResult.processed} successful, ${batchResult.failed} failed. Total: ${totalProcessed} agents (${totalSuccessful} successful, ${totalFailed} failed)`,
      );

      // Log any errors from the batch
      if (batchResult.errors.length > 0) {
        console.log(
          `Batch ${batchNumber} had ${batchResult.errors.length} errors:`,
        );
        batchResult.errors.forEach((error, index) => {
          console.error(
            `  ${index + 1}. Agent ${error.agentId}: ${error.error}`,
          );
        });
      }

      cursor = batchResult.nextCursor;
      batchNumber++;

      if (!batchResult.hasMore) {
        console.log('No more batches to process');
        break;
      }
    } catch (err) {
      console.error(`Batch ${batchNumber} workflow failed completely:`, err);

      // Increment failed count by batch size and continue
      totalFailed += agentFetchBatchSize;
      totalProcessed += agentFetchBatchSize;

      // Try to continue to next batch - this is a best effort
      console.log(
        'Attempting to continue with next batch after complete failure...',
      );
      batchNumber++;

      // If we don't have a way to continue, break
      if (!cursor) {
        console.error(
          'Cannot continue migration - no cursor available after batch failure',
        );
        break;
      }
    }
  } while (cursor);

  return {
    successful: totalSuccessful,
    failed: totalFailed,
    total: totalProcessed,
  };
}

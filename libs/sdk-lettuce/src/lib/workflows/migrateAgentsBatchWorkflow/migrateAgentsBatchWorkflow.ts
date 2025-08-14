import {
  proxyActivities,
  startChild,
  log,
} from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { MigrateAgentPayload } from '../../types';

const { getAgentsBatchFromTemplate } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '2 seconds',
    maximumInterval: '30 seconds',
    backoffCoefficient: 2,
  },
});

export interface MigrateAgentsBatchPayload {
  template: string;
  organizationId: string;
  coreUserId: string;
  cursor?: string;
  batchSize: number;
  workflowBatchSize: number;
  memoryVariables?: Record<string, string>;
  preserveCoreMemories?: boolean;
  preserveToolVariables?: boolean;
  batchNumber: number;
  globalOffset: number;
}

export interface MigrateAgentsBatchResult {
  successful: number;
  failed: number;
  processed: number;
  nextCursor?: string;
  hasMore: boolean;
  errors: Array<{ agentId: string; error: string }>;
}

export async function migrateAgentsBatchWorkflow(
  payload: MigrateAgentsBatchPayload,
): Promise<MigrateAgentsBatchResult> {
  const {
    template,
    organizationId,
    coreUserId,
    cursor,
    batchSize,
    workflowBatchSize,
    memoryVariables,
    preserveCoreMemories,
    preserveToolVariables,
    batchNumber,
    globalOffset,
  } = payload;

  log.info(`Starting batch ${batchNumber} with cursor: ${cursor || 'initial'}`);

  try {
    // Fetch the batch of agents
    const { agents, nextCursor, hasMore } = await getAgentsBatchFromTemplate(
      template,
      organizationId,
      coreUserId,
      cursor,
      batchSize,
    );

    if (agents.length === 0) {
      log.info(`Batch ${batchNumber}: No agents found`);
      return {
        successful: 0,
        failed: 0,
        processed: 0,
        nextCursor,
        hasMore: false,
        errors: [],
      };
    }

    log.info(`Batch ${batchNumber}: Processing ${agents.length} agents`);

    let successful = 0;
    let failed = 0;
    const errors: Array<{ agentId: string; error: string }> = [];

    // Process agents in smaller workflow batches
    for (let i = 0; i < agents.length; i += workflowBatchSize) {
      const batch = agents.slice(i, i + workflowBatchSize);
      const workflowBatchNumber = Math.floor(i / workflowBatchSize) + 1;
      const totalWorkflowBatches = Math.ceil(agents.length / workflowBatchSize);

      log.info(
        `Batch ${batchNumber}: Processing workflow batch ${workflowBatchNumber}/${totalWorkflowBatches} (${batch.length} agents)`,
      );

      // Start individual agent migration workflows for this sub-batch
      const batchHandles = batch.map(async (agent, batchIndex) => {
        const globalIndex = globalOffset + i + batchIndex;
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
            retry: {
              maximumAttempts: 2, // Individual agents get limited retries
              initialInterval: '10 second',
              maximumInterval: '10 seconds',
              backoffCoefficient: 2,
            },
          });

          const result = await handle.result();
          return {
            agentId: agent.agentId,
            success: result,
            error: null as string | null,
          };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log.error(`Failed to migrate agent ${agent.agentId}: ${errorMessage}`);
          return {
            agentId: agent.agentId,
            success: false,
            error: errorMessage,
          };
        }
      });

      // Wait for this workflow batch to complete
      const batchResults = await Promise.allSettled(batchHandles);

      // Process batch results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successful++;
          } else {
            failed++;
            if (result.value.error) {
              errors.push({
                agentId: result.value.agentId,
                error: result.value.error,
              });
            }
          }
        } else {
          failed++;
          log.error(`Workflow batch processing failed: ${result.reason}`);
          errors.push({
            agentId: 'unknown',
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }

      log.info(
        `Batch ${batchNumber}: Workflow batch ${workflowBatchNumber} completed - ${successful} successful, ${failed} failed so far`,
      );
    }

    const result: MigrateAgentsBatchResult = {
      successful,
      failed,
      processed: agents.length,
      nextCursor,
      hasMore,
      errors,
    };

    log.info(
      `Batch ${batchNumber} completed: ${successful}/${agents.length} successful, ${failed} failed, hasMore: ${hasMore}`,
    );

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error(`Batch ${batchNumber} failed completely: ${errorMessage}`);

    // Return failed result for the entire batch
    return {
      successful: 0,
      failed: batchSize, // Assume full batch size failed
      processed: 0,
      nextCursor: cursor,
      hasMore: true, // Assume there might be more to try
      errors: [{ agentId: 'batch-error', error: errorMessage }],
    };
  }
}

import {
  isCancellation,
  startChild,
} from '@temporalio/workflow';
import type { MigrateSingleAgentPayload } from '../../types';
import type { VersionStringWithProject } from '@letta-cloud/utils-shared';

export interface MigrateBatchPayload {
  agents: Array<{
    agentId: string;
    variables: Record<string, string>;
  }>;
  preserveToolVariables?: boolean;
  preserveCoreMemories?: boolean;
  versionString: VersionStringWithProject;
  organizationId: string;
  lettaAgentsId: string;
  batchNumber: number;
}

export interface MigrateBatchResult {
  successful: number;
  failed: number;
  total: number;
  batchNumber: number;
  failedAgentIds: string[];
}

export async function migrateBatchWorkflow(
  payload: MigrateBatchPayload,
): Promise<MigrateBatchResult> {
  const {
    agents,
    preserveToolVariables,
    preserveCoreMemories,
    versionString,
    organizationId,
    lettaAgentsId,
    batchNumber,
  } = payload;

  try {
    console.log(
      `Starting batch ${batchNumber} migration with ${agents.length} agents`,
    );

    // Start child workflows for each agent in this batch
    const agentWorkflowPromises = agents.map(async (agent, index) => {
      const singleAgentPayload: MigrateSingleAgentPayload = {
        agentId: agent.agentId,
        preserveToolVariables,
        preserveCoreMemories,
        versionString,
        organizationId,
        lettaAgentsId,
      };

      try {
        const handle = await startChild('migrateSingleAgentWorkflow', {
          args: [singleAgentPayload],
          workflowId: `migrate-single-agent-${agent.agentId}-batch${batchNumber}-${Date.now()}-${index}`,
        });

        const result = await handle.result();
        return { agentId: agent.agentId, success: result };
      } catch (error) {
        console.error(
          `Failed to migrate agent ${agent.agentId} in batch ${batchNumber}:`,
          error,
        );
        return { agentId: agent.agentId, success: false, error };
      }
    });

    // Wait for all agent workflows in this batch to complete
    const results = await Promise.allSettled(agentWorkflowPromises);

    let successful = 0;
    let failed = 0;
    const failedAgentIds: string[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successful++;
      } else {
        failed++;
        if (result.status === 'fulfilled') {
          failedAgentIds.push(result.value.agentId);
        }

        if (result.status === 'rejected') {
          console.error(
            `Agent workflow failed in batch ${batchNumber}:`,
            result.reason,
          );
        } else if (result.status === 'fulfilled' && !result.value.success) {
          console.error(
            `Agent migration failed for ${result.value.agentId} in batch ${batchNumber}:`,
            (result.value as any).error, // eslint-disable-line @typescript-eslint/no-explicit-any -- Error object structure is dynamic
          );
        }
      }
    }

    console.log(
      `Batch ${batchNumber} completed: ${successful} successful, ${failed} failed`,
    );

    return {
      successful,
      failed,
      total: agents.length,
      batchNumber,
      failedAgentIds,
    };
  } catch (error) {
    if (isCancellation(error)) {
      console.warn(
        `migrateBatchWorkflow batch ${batchNumber} was canceled:`,
        error,
      );
      // Child workflows will be automatically canceled
    }
    throw error;
  }
}

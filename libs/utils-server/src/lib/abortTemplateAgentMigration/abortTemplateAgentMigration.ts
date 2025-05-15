import { Connection } from '@temporalio/client';
import {
  getTemporalConnectionConfig,
  TEMPORAL_LETTUCE_NAMESPACE,
} from '../getTemporalConnectionConfig/getTemporalConnectionConfig';

/**
 * Aborts an agent template migration by canceling the workflow execution in Temporal
 * @param workflowId - The ID of the workflow execution to abort
 * @returns Promise with void
 */

export async function abortTemplateAgentMigration(
  workflowId: string,
): Promise<void> {
  try {
    const connection = await Connection.connect(getTemporalConnectionConfig());
    await connection.workflowService.requestCancelWorkflowExecution({
      namespace: TEMPORAL_LETTUCE_NAMESPACE,
      workflowExecution: {
        workflowId,
      },
    });
  } catch (error) {
    console.error('Error aborting migration:', error);
    throw error;
  }
}

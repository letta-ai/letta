import { Connection } from '@temporalio/client';
import { MigrationStatus } from '@letta-cloud/sdk-cloud-api';
import {
  getTemporalConnectionConfig,
  TEMPORAL_LETTUCE_NAMESPACE,
} from '@letta-cloud/utils-server';

/**
 * Temporal workflow execution status enum
 * Based on: https://typescript.temporal.io/api/enums/proto.temporal.api.enums.v1.WorkflowExecutionStatus
 */
enum WorkflowExecutionStatus {
  UNSPECIFIED = 0,
  RUNNING = 1,
  COMPLETED = 2,
  FAILED = 3,
  CANCELED = 4,
  TERMINATED = 5,
  CONTINUED_AS_NEW = 6,
  TIMED_OUT = 7,
}

function getStatusString(statusCode: number): MigrationStatus {
  const status =
    statusCode in WorkflowExecutionStatus
      ? (statusCode as WorkflowExecutionStatus)
      : undefined;

  switch (status) {
    case WorkflowExecutionStatus.RUNNING:
      return MigrationStatus.RUNNING;
    case WorkflowExecutionStatus.CANCELED:
      return MigrationStatus.CANCELED;
    case WorkflowExecutionStatus.COMPLETED:
    case WorkflowExecutionStatus.CONTINUED_AS_NEW:
      return MigrationStatus.COMPLETED;
    case WorkflowExecutionStatus.FAILED:
    case WorkflowExecutionStatus.TERMINATED:
    case WorkflowExecutionStatus.TIMED_OUT:
    case WorkflowExecutionStatus.UNSPECIFIED:
    default:
      return MigrationStatus.FAILED;
  }
}

export interface MigrationDetail {
  workflowId: string;
  status: MigrationStatus;
  startedAt: string;
  completedAt?: string;
  templateVersion?: string;
}

interface ListTemplateAgentMigrationsOptions {
  templateName: string;
  organizationId: string;
  pageSize?: number;
  nextPageToken?: Uint8Array | null;
}

interface ListTemplateAgentMigrationsResponse {
  migrations: MigrationDetail[];
  nextPage: Uint8Array | null;
}

export async function listTemplateAgentMigrations(
  options: ListTemplateAgentMigrationsOptions,
): Promise<ListTemplateAgentMigrationsResponse> {
  const {
    templateName,
    organizationId,
    pageSize = 1000,
    nextPageToken,
  } = options;

  if (!TEMPORAL_LETTUCE_NAMESPACE) {
    return {
      migrations: [],
      nextPage: null,
    }
  }

  try {
    const connection = await Connection.connect(getTemporalConnectionConfig());
    const query = `Id = "${templateName}" AND OrganizationId = "${organizationId}"`;
    const response = await connection.workflowService.listWorkflowExecutions({
      namespace: TEMPORAL_LETTUCE_NAMESPACE,
      pageSize,
      nextPageToken: nextPageToken ? nextPageToken : null,
      query,
    });

    const migrations = response.executions.map((executionResponse) => {
      const { execution, startTime, status, memo } = executionResponse;
      const workflowId = execution?.workflowId || '';
      const executionStatus = getStatusString(Number(status));
      const memoFields = memo?.fields || {};
      const templateVersionData = memoFields['templateVersion']?.data;
      const templateVersion = templateVersionData
        ? Buffer.from(templateVersionData).toString()
        : undefined;

      const startedAt = new Date(
        Number(startTime?.seconds) * 1000,
      ).toISOString();
      const completedAt = executionResponse.closeTime
        ? new Date(
            Number(executionResponse.closeTime.seconds) * 1000,
          ).toISOString()
        : undefined;

      return {
        workflowId,
        status: executionStatus,
        startedAt,
        completedAt,
        templateVersion,
      };
    });

    return {
      migrations,
      nextPage: response.nextPageToken,
    };
  } catch (error) {
    console.error('Error fetching migrations:', error);
    throw error;
  }
}

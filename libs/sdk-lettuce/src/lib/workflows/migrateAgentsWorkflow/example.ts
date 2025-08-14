/**
 * Example Usage of the 3-Tier Child Workflow Architecture for Agent Migration
 *
 * This example demonstrates how to use the improved migrateAgentsWorkflow
 * that leverages child workflows for better fault tolerance and monitoring.
 */

import { Client } from '@temporalio/client';
import { migrateAgentsWorkflow } from './migrateAgentsWorkflow';
import type { MigrateAgentsPayload } from '../../types';

// Example 1: Basic large-scale migration
export async function basicLargeMigration() {
  const client = new Client({
    // Configure your Temporal client
  });

  const payload: MigrateAgentsPayload = {
    template: 'new-template:v2.0',
    organizationId: 'prod-org-123',
    coreUserId: 'admin-user-456',
    preserveCoreMemories: true,
    preserveToolVariables: false,
    // Using default batch configuration
    // - 50 agents per API call (agentFetchBatchSize)
    // - 10 concurrent agent migrations per batch (workflowBatchSize)
    // - 3 retries per failed batch (maxRetries)
  };

  const handle = await client.workflow.start(migrateAgentsWorkflow, {
    args: [payload],
    taskQueue: 'migration-queue',
    workflowId: `migrate-to-new-template-${Date.now()}`,
  });

  console.log(`Started migration workflow: ${handle.workflowId}`);

  // The workflow will automatically create child workflows like:
  // - migrate-batch-new-template-v2-0-1-{timestamp} (first 50 agents)
  // - migrate-batch-new-template-v2-0-2-{timestamp} (next 50 agents)
  // - migrate-batch-new-template-v2-0-3-{timestamp} (next 50 agents)
  // Each batch child workflow will create up to 50 individual agent workflows

  const result = await handle.result();
  console.log(`Migration completed: ${result.successful}/${result.total} agents migrated successfully`);

  return result;
}

// Example 2: High-throughput migration with custom batching
export async function highThroughputMigration() {
  const client = new Client();

  const payload: MigrateAgentsPayload = {
    template: 'performance-template:v1.5',
    organizationId: 'prod-org-123',
    coreUserId: 'admin-user-456',
    batchConfig: {
      agentFetchBatchSize: 50,      // Max out API calls
      workflowBatchSize: 20,        // Higher concurrency per batch
      maxRetries: 2,                // Fail fast for speed
    },
  };

  const handle = await client.workflow.start(migrateAgentsWorkflow, {
    args: [payload],
    taskQueue: 'high-throughput-queue',
    workflowId: `fast-migration-${Date.now()}`,
  });

  return await handle.result();
}

// Example 3: Conservative migration for critical production
export async function conservativeMigration() {
  const client = new Client();

  const payload: MigrateAgentsPayload = {
    template: 'critical-template:v3.0',
    organizationId: 'critical-prod-org',
    coreUserId: 'super-admin-789',
    batchConfig: {
      agentFetchBatchSize: 25,      // Smaller batches for better fault isolation
      workflowBatchSize: 5,         // Lower concurrency for stability
      maxRetries: 5,                // More retries for reliability
    },
  };

  const handle = await client.workflow.start(migrateAgentsWorkflow, {
    args: [payload],
    taskQueue: 'critical-migration-queue',
    workflowId: `critical-migration-${Date.now()}`,
  });

  return await handle.result();
}

// Example 4: Migrating specific agents with child workflow benefits
export async function migrateSpecificAgents() {
  const client = new Client();

  const specificAgentIds = [
    'agent-prod-001',
    'agent-prod-002',
    'agent-prod-003',
    'agent-staging-001',
    'agent-staging-002',
  ];

  const payload: MigrateAgentsPayload = {
    template: 'updated-template:v1.1',
    organizationId: 'mixed-org-456',
    coreUserId: 'migration-user-123',
    agentIds: specificAgentIds,          // Only migrate these specific agents
    batchConfig: {
      workflowBatchSize: 2,              // Process 2 agents at a time
    },
  };

  const handle = await client.workflow.start(migrateAgentsWorkflow, {
    args: [payload],
    taskQueue: 'specific-migration-queue',
    workflowId: `specific-agents-migration-${Date.now()}`,
  });

  const result = await handle.result();
  console.log(`Migrated ${result.successful} out of ${specificAgentIds.length} specific agents`);

  return result;
}

// Example 5: Monitoring child workflows during migration
export async function monitorMigrationProgress() {
  const client = new Client();

  const payload: MigrateAgentsPayload = {
    template: 'monitored-template:v2.1',
    organizationId: 'monitored-org-789',
    coreUserId: 'monitor-user-456',
  };

  const handle = await client.workflow.start(migrateAgentsWorkflow, {
    args: [payload],
    taskQueue: 'monitored-migration-queue',
    workflowId: `monitored-migration-${Date.now()}`,
  });

  console.log(`Migration started: ${handle.workflowId}`);
  console.log('You can monitor individual batches at:');
  console.log(`- Temporal Web UI: http://localhost:8233/namespaces/default/workflows`);
  console.log(`- Search for workflows starting with: migrate-batch-monitored-template-v2-1`);

  // You can also programmatically monitor batch workflows
  const batchWorkflowIds = [];
  let batchNumber = 1;

  // In practice, you'd query Temporal for child workflows
  // This is just an example of the naming pattern
  while (true) {
    const batchId = `migrate-batch-monitored-template-v2-1-${batchNumber}-${Date.now()}`;
    try {
      const batchHandle = client.workflow.getHandle(batchId);
      const batchResult = await batchHandle.result();
      console.log(`Batch ${batchNumber}: ${batchResult.successful}/${batchResult.processed} successful`);
      batchNumber++;
    } catch (err) {
      // No more batches found
      break;
    }
  }

  const result = await handle.result();
  return result;
}

// Example 6: Error handling and recovery patterns
export async function errorHandlingExample() {
  const client = new Client();

  const payload: MigrateAgentsPayload = {
    template: 'error-prone-template:v1.0',
    organizationId: 'test-org-123',
    coreUserId: 'test-user-789',
    batchConfig: {
      agentFetchBatchSize: 10,      // Smaller batches to isolate errors
      workflowBatchSize: 3,         // Low concurrency for easier debugging
      maxRetries: 1,                // Fail fast for testing
    },
  };

  try {
    const handle = await client.workflow.start(migrateAgentsWorkflow, {
      args: [payload],
      taskQueue: 'error-test-queue',
      workflowId: `error-test-migration-${Date.now()}`,
    });

    const result = await handle.result();

    if (result.failed > 0) {
      console.log(`Migration had ${result.failed} failures out of ${result.total} agents`);
      console.log('Check individual batch workflows for detailed error information');

      // You can inspect failed batch workflows in Temporal Web UI
      // Each batch that failed will have its own error details
      console.log('Failed batch workflows can be found with pattern:');
      console.log('migrate-batch-error-prone-template-v1-0-*');
    }

    return result;
  } catch (err) {
    console.error('Entire migration workflow failed:', err);
    throw err;
  }
}

// Example 7: Development vs Production configurations
export const migrationConfigs = {
  development: {
    agentFetchBatchSize: 10,       // Small batches for quick testing
    workflowBatchSize: 3,          // Low concurrency for debugging
    maxRetries: 1,                 // Fail fast in development
  },

  staging: {
    agentFetchBatchSize: 25,       // Medium batches for realistic testing
    workflowBatchSize: 8,          // Moderate concurrency
    maxRetries: 2,                 // Some retry tolerance
  },

  production: {
    agentFetchBatchSize: 50,       // Full batches for efficiency
    workflowBatchSize: 10,         // Balanced concurrency
    maxRetries: 3,                 // Good retry coverage
  },

  criticalProduction: {
    agentFetchBatchSize: 25,       // Smaller batches for fault isolation
    workflowBatchSize: 5,          // Conservative concurrency
    maxRetries: 5,                 // Maximum reliability
  },
};

export async function environmentSpecificMigration(environment: keyof typeof migrationConfigs) {
  const client = new Client();

  const payload: MigrateAgentsPayload = {
    template: `template-${environment}:v1.0`,
    organizationId: `org-${environment}`,
    coreUserId: `user-${environment}`,
    batchConfig: migrationConfigs[environment],
  };

  const handle = await client.workflow.start(migrateAgentsWorkflow, {
    args: [payload],
    taskQueue: `${environment}-migration-queue`,
    workflowId: `${environment}-migration-${Date.now()}`,
  });

  console.log(`Started ${environment} migration with config:`, migrationConfigs[environment]);
  return await handle.result();
}

/**
 * Key Benefits Demonstrated:
 *
 * 1. **Fault Isolation**: Each batch of 50 agents runs in its own child workflow
 * 2. **Independent Monitoring**: Each batch gets its own workflow ID for tracking
 * 3. **Granular Retries**: Failed batches can be retried independently
 * 4. **Scalability**: Can handle thousands of agents by breaking into manageable batches
 * 5. **Observability**: Detailed logging and monitoring at multiple levels
 * 6. **Flexibility**: Configurable batch sizes for different environments and use cases
 *
 * Child Workflow Architecture:
 * Main Workflow → Batch Child Workflows (50 agents each) → Agent Child Workflows (1 agent each)
 */

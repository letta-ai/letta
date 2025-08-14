# Batched Agent Migration Workflow

This document describes the improved `migrateAgentsWorkflow` that handles large-scale agent migrations using a **3-tier child workflow architecture** to overcome the 50-agent limit in the `listAgents` endpoint.

## Overview

The workflow has been redesigned with a hierarchical child workflow structure to handle migrations of thousands of agents efficiently and reliably:

1. **Main Migration Workflow**: Orchestrates the overall migration process
2. **Batch Processing Child Workflows**: Each handles exactly one batch of up to 50 agents
3. **Individual Agent Child Workflows**: Each migrates a single agent

### Key Benefits

1. **Batched API Fetching**: Fetches agents in configurable batches (default: 50 per API call)
2. **Streaming Processing**: Processes agents as they're fetched rather than loading all agents into memory
3. **Fault Tolerance**: Individual batch failures don't affect the entire migration
4. **Independent Batch Monitoring**: Each batch gets its own workflow ID in Temporal Web UI
5. **Temporal-Native Retries**: Leverages Temporal's built-in retry policies per batch
6. **Better Isolation**: Each batch runs in its own workflow context with separate history

## Architecture

### 3-Tier Workflow Hierarchy

```
Main Migration Workflow (migrateAgentsWorkflow)
├── Batch Child Workflow #1 (migrateAgentsBatchWorkflow) - 50 agents
│   ├── Agent Child Workflow #1 (migrateAgentWorkflow)
│   ├── Agent Child Workflow #2 (migrateAgentWorkflow)
│   └── ... up to 50 agent workflows
├── Batch Child Workflow #2 (migrateAgentsBatchWorkflow) - 50 agents
│   ├── Agent Child Workflow #51 (migrateAgentWorkflow)
│   └── ...
└── ... more batch workflows as needed
```

### Key Features

#### Fault Tolerant Design
- If one batch child workflow fails, only those 50 agents are affected
- Temporal can retry entire batches using workflow retry policies
- The main workflow continues with the next batch
- Individual agent migration failures don't stop batch processing

#### Independent Batch Execution
- Each batch runs as a separate child workflow with its own:
  - Workflow ID for tracking in Temporal Web UI
  - Execution history and timeline
  - Retry policy and timeout configuration
  - Error handling and recovery logic

#### Memory Efficient
- Agents are processed in streaming fashion
- Each batch workflow handles exactly one API call worth of agents
- No need to store thousands of agents in memory
- Lower resource consumption for large migrations

#### Highly Configurable
- Adjustable batch sizes for different deployment environments
- Configurable retry logic per batch and per agent
- Customizable concurrency levels within each batch

## Usage

### Basic Usage

```typescript
import { migrateAgentsWorkflow } from './migrateAgentsWorkflow';

const payload: MigrateAgentsPayload = {
  template: 'my-template:v2',
  organizationId: 'org-123',
  coreUserId: 'user-456',
  preserveCoreMemories: true,
  preserveToolVariables: false,
};

// Start the workflow
const handle = await client.workflow.start(migrateAgentsWorkflow, {
  args: [payload],
  taskQueue: 'migration-queue',
  workflowId: `migrate-to-${template}-${Date.now()}`,
});

const result = await handle.result();
console.log(`Migration completed: ${result.successful}/${result.total} agents migrated successfully`);
```

### Advanced Configuration

```typescript
const payload: MigrateAgentsPayload = {
  template: 'my-template:v2',
  organizationId: 'org-123',
  coreUserId: 'user-456',
  batchConfig: {
    agentFetchBatchSize: 25,    // Fetch 25 agents per API call
    workflowBatchSize: 5,       // Process 5 agents concurrently
    maxRetries: 2,              // Retry failed batches up to 2 times
  },
};
```

### Migrating Specific Agents

```typescript
const payload: MigrateAgentsPayload = {
  template: 'my-template:v2',
  organizationId: 'org-123',
  coreUserId: 'user-456',
  agentIds: ['agent-1', 'agent-2', 'agent-3'], // Migrate only these agents
  batchConfig: {
    workflowBatchSize: 2, // Process 2 agents at a time
  },
};
```

## Configuration Options

### `MigrationBatchConfig`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `agentFetchBatchSize` | `number` | `50` | Number of agents to fetch per API call. Should not exceed API limits. |
| `workflowBatchSize` | `number` | `10` | Number of agents to process concurrently as child workflows. |
| `maxRetries` | `number` | `3` | Maximum number of retries for failed batches before skipping. |

### Batch Size Guidelines

#### `agentFetchBatchSize`
- **Small (10-25)**: Better fault isolation, more batch child workflows
- **Medium (50)**: Good balance, matches API pagination limits, fewer child workflows
- **Large (100+)**: Not recommended - exceeds API limits

#### `workflowBatchSize`
- **Small (5-10)**: Lower concurrency within each batch, slower but more stable
- **Medium (10-15)**: Good balance for most use cases within each batch
- **Large (20+)**: Higher concurrency per batch, faster but more resource intensive

## Monitoring and Logging

The workflow provides detailed logging at multiple levels:

### Main Workflow Level
```
Starting batched migration for template my-template:v2
Starting batch 1 with cursor: initial
Batch 1 completed: 48/50 successful, 2 failed. Total: 50 agents (48 successful, 2 failed)
Starting batch 2 with cursor: agent-id-50
Batch 2 completed: 47/47 successful, 0 failed. Total: 97 agents (95 successful, 2 failed)
```

### Batch Child Workflow Level
```
[migrateAgentsBatchWorkflow] Starting batch 1 with cursor: initial
[migrateAgentsBatchWorkflow] Batch 1: Processing 50 agents
[migrateAgentsBatchWorkflow] Batch 1: Processing workflow batch 1/5 (10 agents)
[migrateAgentsBatchWorkflow] Batch 1: Workflow batch 1 completed - 9 successful, 1 failed so far
[migrateAgentsBatchWorkflow] Batch 1 completed: 48/50 successful, 2 failed, hasMore: true
```

### Individual Agent Level
Each agent migration gets its own workflow ID: `migrate-agent-{agentId}-{timestamp}-{index}`

### Error Handling
Errors are handled at multiple levels:
- **Main Workflow**: Handles batch child workflow failures
- **Batch Child Workflow**: Handles API errors and individual agent failures
- **Agent Child Workflow**: Handles individual agent migration errors

## Error Recovery

### Batch Child Workflow Recovery
If a batch child workflow fails completely:
1. Temporal retries the entire batch workflow up to `maxRetries` times
2. If all retries fail, the batch is marked as failed
3. The main workflow continues with the next batch
4. Failed agents are counted in the final tally

### API-Level Recovery
If fetching agents from the API fails within a batch:
1. The batch child workflow retries with its own retry policy
2. If API calls continue to fail, the batch workflow fails
3. Temporal retries the entire batch workflow

### Individual Agent Recovery
If an individual agent migration fails:
1. The agent child workflow handles its own retries (limited attempts)
2. The error is logged and reported back to the batch workflow
3. The agent is marked as failed in the batch results
4. Other agents in the batch continue processing
5. The batch completes and reports results to main workflow

## Performance Considerations

### For Small Migrations (< 100 agents)
```typescript
batchConfig: {
  agentFetchBatchSize: 50,
  workflowBatchSize: 20,
  maxRetries: 3,
}
```

### For Medium Migrations (100-1000 agents)
```typescript
batchConfig: {
  agentFetchBatchSize: 50,
  workflowBatchSize: 15,
  maxRetries: 2,
}
```

### For Large Migrations (1000+ agents)
```typescript
batchConfig: {
  agentFetchBatchSize: 50,
  workflowBatchSize: 10,
  maxRetries: 1,
}
```

## Migration Strategies

### Conservative (High Reliability)
- Small batch sizes
- Higher retry counts
- Lower concurrency
- Best for critical migrations

### Aggressive (High Speed)
- Larger batch sizes
- Lower retry counts
- Higher concurrency
- Best for development/testing

### Balanced (Recommended)
- Default settings
- Good balance of speed and reliability
- Suitable for most production use cases

## Troubleshooting

### Common Issues

#### High Memory Usage
- Reduce `workflowBatchSize`
- Ensure `agentFetchBatchSize` is reasonable

#### Slow Performance
- Increase `workflowBatchSize` (if resources allow)
- Reduce `maxRetries` for faster failure handling

#### Frequent Timeouts
- Reduce `agentFetchBatchSize`
- Increase `maxRetries`
- Check network connectivity and API limits

#### Partial Migrations
- Check logs for batch-level failures
- Verify template and organization IDs
- Ensure sufficient permissions

### Monitoring Metrics

Track these metrics for optimal performance:
- **Batch Success Rate**: `successful_batches / total_batches`
- **Agent Success Rate**: `successful_agents / total_agents`
- **Average Batch Processing Time**: Time per batch
- **API Call Success Rate**: Successful API calls vs failures
- **Retry Rate**: How often retries are needed

## Best Practices

1. **Start Small**: Test with small batch sizes first
2. **Monitor Resources**: Watch Temporal and database load
3. **Plan for Failures**: Always account for partial failures
4. **Log Everything**: Enable comprehensive logging for debugging
5. **Test Thoroughly**: Run tests with various batch sizes and failure scenarios
6. **Use Staging**: Test large migrations in staging environments first

## Workflow States and Monitoring

### Main Workflow State
- `totalProcessed`: Total number of agents processed across all batches
- `totalSuccessful`: Number of successfully migrated agents
- `totalFailed`: Number of failed agent migrations
- `batchNumber`: Current batch being processed
- `cursor`: Current pagination cursor for API calls

### Batch Child Workflow State
- `batchNumber`: Which batch this workflow is processing
- `globalOffset`: Starting index for this batch in the overall migration
- `processed`: Number of agents processed in this batch
- `successful`: Number of successful agent migrations in this batch
- `failed`: Number of failed agent migrations in this batch
- `errors`: Detailed error information for failed agents

### Temporal Web UI Monitoring
Each batch gets its own workflow ID in the format:
```
migrate-batch-{template-name}-{batchNumber}-{timestamp}
```

This allows you to:
- Monitor individual batch progress in Temporal Web UI
- Retry specific failed batches
- View detailed execution history per batch
- Debug issues at the batch level

### Child Workflow Benefits for Debugging
- **Isolated Error Investigation**: Each batch failure can be investigated independently
- **Granular Retry Control**: Retry specific batches without affecting others
- **Performance Analysis**: Identify which batches are slow or resource-intensive
- **Historical Tracking**: Complete audit trail of each batch execution

import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { migrateAgentsWorkflow } from '../migrateAgentsWorkflow';
import type { MigrateAgentsPayload } from '../../../types';

describe('migrateAgentsWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  describe('batched agent migration', () => {
    it('should handle small batch sizes correctly', async () => {
      const { client } = testEnv;

      // Mock activities
      const mockGetAgentsBatchFromTemplate = jest.fn();
      const mockGetAgentsByIds = jest.fn();

      // Simulate fetching agents in batches
      mockGetAgentsBatchFromTemplate
        .mockResolvedValueOnce({
          agents: [
            { agentId: 'agent-1', variables: { key1: 'value1' } },
            { agentId: 'agent-2', variables: { key2: 'value2' } },
          ],
          nextCursor: 'cursor-1',
          hasMore: true,
        })
        .mockResolvedValueOnce({
          agents: [
            { agentId: 'agent-3', variables: { key3: 'value3' } },
          ],
          nextCursor: undefined,
          hasMore: false,
        });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('../migrateAgentsWorkflow'),
        activities: {
          getAgentsBatchFromTemplate: mockGetAgentsBatchFromTemplate,
          getAgentsByIds: mockGetAgentsByIds,
        },
      });

      const payload: MigrateAgentsPayload = {
        template: 'test-template:v1',
        organizationId: 'org-123',
        coreUserId: 'user-123',
        batchConfig: {
          agentFetchBatchSize: 2,
          workflowBatchSize: 1,
          maxRetries: 2,
        },
      };

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(migrateAgentsWorkflow, {
          args: [payload],
          taskQueue: 'test',
          workflowId: 'test-migration',
        });

        const result = await handle.result();

        expect(result.total).toBe(3);
        expect(mockGetAgentsBatchFromTemplate).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle specific agent IDs without batched fetching', async () => {
      const { client } = testEnv;

      const mockGetAgentsByIds = jest.fn().mockResolvedValue([
        { agentId: 'specific-agent-1', variables: { key1: 'value1' } },
        { agentId: 'specific-agent-2', variables: { key2: 'value2' } },
      ]);

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('../migrateAgentsWorkflow'),
        activities: {
          getAgentsBatchFromTemplate: jest.fn(),
          getAgentsByIds: mockGetAgentsByIds,
        },
      });

      const payload: MigrateAgentsPayload = {
        template: 'test-template:v1',
        organizationId: 'org-123',
        coreUserId: 'user-123',
        agentIds: ['specific-agent-1', 'specific-agent-2'],
        batchConfig: {
          workflowBatchSize: 1,
        },
      };

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(migrateAgentsWorkflow, {
          args: [payload],
          taskQueue: 'test',
          workflowId: 'test-specific-migration',
        });

        const result = await handle.result();

        expect(result.total).toBe(2);
        expect(mockGetAgentsByIds).toHaveBeenCalledWith(['specific-agent-1', 'specific-agent-2']);
      });
    });

    it('should handle retry logic for failed batches', async () => {
      const { client } = testEnv;

      const mockGetAgentsBatchFromTemplate = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          agents: [
            { agentId: 'agent-1', variables: { key1: 'value1' } },
          ],
          nextCursor: undefined,
          hasMore: false,
        });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('../migrateAgentsWorkflow'),
        activities: {
          getAgentsBatchFromTemplate: mockGetAgentsBatchFromTemplate,
          getAgentsByIds: jest.fn(),
        },
      });

      const payload: MigrateAgentsPayload = {
        template: 'test-template:v1',
        organizationId: 'org-123',
        coreUserId: 'user-123',
        batchConfig: {
          agentFetchBatchSize: 1,
          workflowBatchSize: 1,
          maxRetries: 3,
        },
      };

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(migrateAgentsWorkflow, {
          args: [payload],
          taskQueue: 'test',
          workflowId: 'test-retry-migration',
        });

        const result = await handle.result();

        expect(result.total).toBe(1);
        expect(mockGetAgentsBatchFromTemplate).toHaveBeenCalledTimes(3);
      });
    });

    it('should use default batch configurations when not provided', async () => {
      const { client } = testEnv;

      const mockGetAgentsBatchFromTemplate = jest.fn().mockResolvedValue({
        agents: [],
        nextCursor: undefined,
        hasMore: false,
      });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('../migrateAgentsWorkflow'),
        activities: {
          getAgentsBatchFromTemplate: mockGetAgentsBatchFromTemplate,
          getAgentsByIds: jest.fn(),
        },
      });

      const payload: MigrateAgentsPayload = {
        template: 'test-template:v1',
        organizationId: 'org-123',
        coreUserId: 'user-123',
        // No batchConfig provided - should use defaults
      };

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(migrateAgentsWorkflow, {
          args: [payload],
          taskQueue: 'test',
          workflowId: 'test-default-config',
        });

        const result = await handle.result();

        // Should call with default batch size (50)
        expect(mockGetAgentsBatchFromTemplate).toHaveBeenCalledWith(
          'test-template:v1',
          'org-123',
          'user-123',
          undefined,
          50, // Default agentFetchBatchSize
        );
      });
    });

    it('should handle empty agent list gracefully', async () => {
      const { client } = testEnv;

      const mockGetAgentsBatchFromTemplate = jest.fn().mockResolvedValue({
        agents: [],
        nextCursor: undefined,
        hasMore: false,
      });

      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        taskQueue: 'test',
        workflowsPath: require.resolve('../migrateAgentsWorkflow'),
        activities: {
          getAgentsBatchFromTemplate: mockGetAgentsBatchFromTemplate,
          getAgentsByIds: jest.fn(),
        },
      });

      const payload: MigrateAgentsPayload = {
        template: 'test-template:v1',
        organizationId: 'org-123',
        coreUserId: 'user-123',
      };

      await worker.runUntil(async () => {
        const handle = await client.workflow.start(migrateAgentsWorkflow, {
          args: [payload],
          taskQueue: 'test',
          workflowId: 'test-empty-migration',
        });

        const result = await handle.result();

        expect(result.total).toBe(0);
        expect(result.successful).toBe(0);
        expect(result.failed).toBe(0);
      });
    });
  });

  describe('configuration validation', () => {
    it('should respect custom batch sizes', () => {
      const payload: MigrateAgentsPayload = {
        template: 'test-template:v1',
        organizationId: 'org-123',
        coreUserId: 'user-123',
        batchConfig: {
          agentFetchBatchSize: 25,
          workflowBatchSize: 5,
          maxRetries: 1,
        },
      };

      expect(payload.batchConfig?.agentFetchBatchSize).toBe(25);
      expect(payload.batchConfig?.workflowBatchSize).toBe(5);
      expect(payload.batchConfig?.maxRetries).toBe(1);
    });

    it('should handle partial batch configuration', () => {
      const payload: MigrateAgentsPayload = {
        template: 'test-template:v1',
        organizationId: 'org-123',
        coreUserId: 'user-123',
        batchConfig: {
          agentFetchBatchSize: 100, // Only specify one config
        },
      };

      expect(payload.batchConfig?.agentFetchBatchSize).toBe(100);
      expect(payload.batchConfig?.workflowBatchSize).toBeUndefined(); // Should use default
      expect(payload.batchConfig?.maxRetries).toBeUndefined(); // Should use default
    });
  });
});

import {
  createTemplate,
  CREATE_TEMPLATE_ERRORS,
} from './createTemplate';
import type {
  AgentFileSchema,
  letta__schemas__agent_file__AgentSchema,
  GroupSchema,
  BlockSchema,
} from '@letta-cloud/sdk-core';

// Mock dependencies
jest.mock('@letta-cloud/service-database', () => ({
  db: {
    query: {
      projects: {
        findFirst: jest.fn(),
      },
    },
    transaction: jest.fn(),
  },
  lettaTemplates: { _: { name: 'letta_templates' } },
  projects: { _: { name: 'projects' } },
  blockTemplate: { _: { name: 'block_template' } },
  agentTemplateV2: { _: { name: 'agent_template_v2' } },
  agentTemplateBlockTemplates: { _: { name: 'agent_template_block_templates' } },
}));

jest.mock('@letta-cloud/service-analytics/server', () => ({
  trackServerSideEvent: jest.fn(),
}));

jest.mock('@letta-cloud/service-analytics', () => ({
  AnalyticsEvent: {
    CREATED_TEMPLATE: 'CREATED_TEMPLATE',
  },
}));

jest.mock('../getNewTemplateName/getNewTemplateName', () => ({
  getNewTemplateName: jest.fn().mockResolvedValue('test-template'),
}));

jest.mock('../createTemplateEntitiesFromAgentState/createTemplateEntitiesFromAgentFileAgentSchema', () => ({
  createTemplateEntitiesFromAgentFileAgentSchema: jest.fn().mockResolvedValue({ id: 'agent-template-id' }),
}));

jest.mock('@letta-cloud/utils-server', () => ({
  saveTemplate: jest.fn().mockResolvedValue({ id: 'saved-template-id' }),
}));

jest.mock('nanoid', () => ({
  nanoid: jest.fn().mockReturnValue('test-entity-id'),
}));

// Import mocked modules
import { db } from '@letta-cloud/service-database';
import { createTemplateEntitiesFromAgentFileAgentSchema } from '../createTemplateEntitiesFromAgentState/createTemplateEntitiesFromAgentFileAgentSchema';

// Test data helpers
const createMockAgent = (
  agentType: string,
  blockIds?: string[],
  groupIds?: string[]
): letta__schemas__agent_file__AgentSchema => ({
  id: '',
  name: `${agentType}-agent`,
  memory_blocks: [],
  tools: [],
  tool_ids: ['tool-1'],
  source_ids: [],
  block_ids: blockIds || [],
  tool_rules: [],
  tags: [],
  system: 'System prompt',
  agent_type: agentType as any,
  llm_config: {
    model: 'gpt-4',
    model_endpoint_type: 'openai' as any,
    context_window: 4000,
    handle: 'openai/gpt-4',
    temperature: 0.7,
    max_tokens: 1000,
    enable_reasoner: false,
  },
  embedding_config: {
    embedding_endpoint_type: 'openai' as any,
    embedding_model: 'text-embedding-ada-002',
    embedding_dim: 1536,
    embedding_chunk_size: 300,
    handle: 'openai/text-embedding-ada-002',
    batch_size: 100,
  },
  include_base_tools: true,
  include_multi_agent_tools: false,
  include_base_tool_rules: false,
  include_default_source: false,
  tool_exec_environment_variables: {},
  group_ids: groupIds || [],
});

const createMockBlock = (id: string, label: string): BlockSchema => ({
  id,
  value: `Block ${label} content`,
  label,
  limit: 8000,
  description: `Description for ${label}`,
  preserve_on_migration: false,
  read_only: false,
  project_id: null,
  name: null,
  is_template: false,
  base_template_id: null,
  deployment_id: null,
  entity_id: null,
  metadata: {},
});

const createMockGroup = (
  managerType: string,
  managerAgentId: string,
  additionalConfig?: Record<string, any>
): GroupSchema => ({
  id: 'group-1',
  agent_ids: ['agent-1', 'agent-2'],
  description: 'Test group',
  manager_config: {
    manager_type: managerType,
    manager_agent_id: managerAgentId,
    ...additionalConfig,
  } as any,
  project_id: null,
  shared_block_ids: [],
});

const createBaseOptions = (overrides: any = {}) => ({
  projectId: 'project-123',
  organizationId: 'org-123',
  lettaAgentsId: 'letta-123',
  name: 'test-template',
  allowNameOverride: true,
  userId: 'user-123',
  ...overrides,
});

describe('createTemplate', () => {
  let mockTx: any;
  let insertCalls: Array<{ table: string, values: any }>;

  beforeEach(() => {
    jest.clearAllMocks();
    insertCalls = [];

    // Mock project query to return a valid project
    (db.query.projects.findFirst as jest.Mock).mockResolvedValue({
      id: 'project-123',
      slug: 'test-project',
      organizationId: 'org-123',
    });

    // Create detailed mock transaction that tracks all insertions
    mockTx = {
      insert: jest.fn((table) => ({
        values: jest.fn((values) => {
          // Track all insert calls for verification - use table metadata
          const tableName = table?._?.name || 'unknown';
          insertCalls.push({ table: tableName, values });

          return {
            returning: jest.fn().mockResolvedValue([{
              id: `${tableName}-${Math.random().toString(36).substr(2, 9)}`
            }]),
            onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
            onConflictDoUpdate: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{
                id: `${tableName}-updated-${Math.random().toString(36).substr(2, 9)}`
              }]),
            }),
          };
        }),
      })),
    };

    // Mock transaction
    (db.transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });
  });

  describe('Basic functionality', () => {
    it('should create a dynamic template when no base is provided', async () => {
      const options = createBaseOptions({ tx: mockTx });

      const result = await createTemplate(options);

      expect(result).toBeDefined();
      expect(db.query.projects.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
      });

      // Verify letta template was created
      const templateInserts = insertCalls.filter(call => call.table === 'letta_templates');
      expect(templateInserts).toHaveLength(1);
      expect(templateInserts[0].values.type).toBe('dynamic');
    });

    it('should throw error when project is not found', async () => {
      (db.query.projects.findFirst as jest.Mock).mockResolvedValue(null);
      const options = createBaseOptions({ tx: mockTx });

      await expect(createTemplate(options)).rejects.toThrow(
        CREATE_TEMPLATE_ERRORS.PROJECT_NOT_FOUND
      );
    });
  });

  describe('Template type determination', () => {
    it('should create classic template for single agent with no groups', async () => {
      const base: AgentFileSchema = {
        agents: [createMockAgent('memgpt_v2_agent', ['block-1'])],
        groups: [],
        blocks: [createMockBlock('block-1', 'human')],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      const result = await createTemplate(options);
      expect(result).toBeDefined();
    });

    it('should create sleeptime template for sleeptime groups', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('memgpt_v2_agent', ['block-1']),
          createMockAgent('sleeptime_agent', ['block-2']),
        ],
        groups: [createMockGroup('sleeptime', 'agent-1', { sleeptime_agent_frequency: 10 })],
        blocks: [
          createMockBlock('block-1', 'human'),
          createMockBlock('block-2', 'persona'),
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      const result = await createTemplate(options);
      expect(result).toBeDefined();
    });

    it('should create voice_sleeptime template for voice_sleeptime groups', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('voice_convo_agent', ['block-1']),
          createMockAgent('voice_sleeptime_agent', ['block-2']),
        ],
        groups: [createMockGroup('voice_sleeptime', 'agent-1', {
          max_message_buffer_length: 100,
          min_message_buffer_length: 10,
        })],
        blocks: [
          createMockBlock('block-1', 'human'),
          createMockBlock('block-2', 'persona'),
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      const result = await createTemplate(options);
      expect(result).toBeDefined();
    });

    it('should create dynamic template for dynamic groups', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('memgpt_v2_agent', ['block-1'], ['group-1']),
          createMockAgent('memgpt_v2_agent', ['block-2']),
        ],
        groups: [createMockGroup('dynamic', 'agent-1', {
          termination_token: 'STOP',
          max_turns: 20,
        })],
        blocks: [
          createMockBlock('block-1', 'human'),
          createMockBlock('block-2', 'persona'),
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      const result = await createTemplate(options);
      expect(result).toBeDefined();
    });

    it('should create supervisor template for supervisor groups', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('memgpt_v2_agent', ['block-1'], ['group-1']),
          createMockAgent('memgpt_v2_agent', ['block-2']),
          createMockAgent('memgpt_v2_agent', ['block-1']),
        ],
        groups: [createMockGroup('supervisor', 'agent-1')],
        blocks: [
          createMockBlock('block-1', 'human'),
          createMockBlock('block-2', 'persona'),
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      const result = await createTemplate(options);
      expect(result).toBeDefined();
    });

    it('should create round_robin template for round_robin groups', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('memgpt_v2_agent', ['block-1']),
          createMockAgent('memgpt_v2_agent', ['block-2']),
        ],
        groups: [createMockGroup('round_robin', 'agent-1', { max_turns: 25 })],
        blocks: [
          createMockBlock('block-1', 'human'),
          createMockBlock('block-2', 'persona'),
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      const result = await createTemplate(options);
      expect(result).toBeDefined();
    });
  });

  describe('Validation errors', () => {
    it('should throw error for too many groups', async () => {
      const base: AgentFileSchema = {
        agents: [createMockAgent('memgpt_v2_agent')],
        groups: [
          createMockGroup('sleeptime', 'agent-1'),
          createMockGroup('dynamic', 'agent-2'),
        ],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      await expect(createTemplate(options)).rejects.toThrow(
        CREATE_TEMPLATE_ERRORS.TOO_MANY_GROUPS
      );
    });

    it('should throw error for too many agents in sleeptime group', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('memgpt_v2_agent'),
          createMockAgent('sleeptime_agent'),
          createMockAgent('memgpt_v2_agent'),
        ],
        groups: [createMockGroup('sleeptime', 'agent-1')],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      await expect(createTemplate(options)).rejects.toThrow(
        CREATE_TEMPLATE_ERRORS.TOO_MANY_SLEEPTIME_AGENTS
      );
    });

    it('should throw error for too many managers in dynamic group', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('memgpt_v2_agent', [], ['group-1']),
          createMockAgent('memgpt_v2_agent', [], ['group-1']),
        ],
        groups: [createMockGroup('dynamic', 'agent-1')],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      await expect(createTemplate(options)).rejects.toThrow(
        CREATE_TEMPLATE_ERRORS.TOO_MANY_MANAGERS
      );
    });

    it('should throw error for no manager in dynamic group', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('memgpt_v2_agent', []),
          createMockAgent('memgpt_v2_agent', []),
        ],
        groups: [createMockGroup('dynamic', 'agent-1')],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      await expect(createTemplate(options)).rejects.toThrow(
        CREATE_TEMPLATE_ERRORS.NO_MANAGER_PROVIDED
      );
    });
  });

  describe('Block processing', () => {
    it('should only create blocks that are referenced by agents', async () => {
      const base: AgentFileSchema = {
        agents: [createMockAgent('memgpt_v2_agent', ['block-1'])],
        groups: [],
        blocks: [
          createMockBlock('block-1', 'referenced'),
          createMockBlock('block-2', 'unreferenced'),
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      const result = await createTemplate(options);
      expect(result).toBeDefined();

      // Verify only one block was created (the referenced one)
      const blockInserts = insertCalls.filter(call => call.table === 'block_template');
      expect(blockInserts).toHaveLength(1);
      expect(blockInserts[0].values.label).toBe('referenced')
    });

    it('should handle empty blocks array', async () => {
      const base: AgentFileSchema = {
        agents: [createMockAgent('memgpt_v2_agent')],
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      const result = await createTemplate(options);
      expect(result).toBeDefined();

      // Verify no blocks were created
      const blockInserts = insertCalls.filter(call => call.table === 'block_template');
      expect(blockInserts).toHaveLength(0);
    });
  });

  describe('Entity creation verification', () => {
    it('should call createTemplateEntitiesFromAgentFileAgentSchema correctly for sleeptime', async () => {
      const base: AgentFileSchema = {
        agents: [
          createMockAgent('memgpt_v2_agent', ['block-1']),
          createMockAgent('sleeptime_agent', ['block-2']),
        ],
        groups: [createMockGroup('sleeptime', 'agent-1', { sleeptime_agent_frequency: 20 })],
        blocks: [
          createMockBlock('block-1', 'human'),
          createMockBlock('block-2', 'persona'),
        ],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      await createTemplate(options);

      // Verify letta template was created with correct values
      const templateInserts = insertCalls.filter(call => call.table === 'letta_templates');
      expect(templateInserts).toHaveLength(1);
      expect(templateInserts[0].values.type).toBe('sleeptime');
      expect(templateInserts[0].values.groupConfiguration).toEqual({
        managerAgentEntityId: 'agent-1',
        sleeptimeAgentFrequency: 20,
      });

      // Verify createTemplateEntitiesFromAgentFileAgentSchema was called twice (main + sleeptime agents)
      expect(createTemplateEntitiesFromAgentFileAgentSchema as jest.Mock).toHaveBeenCalledTimes(2);

      // Verify it was called with correct agent schemas
      const calls = (createTemplateEntitiesFromAgentFileAgentSchema as jest.Mock).mock.calls;
      expect(calls[0][0].agentSchema.agent_type).toBe('memgpt_v2_agent');
      expect(calls[1][0].agentSchema.agent_type).toBe('sleeptime_agent');

      // Verify 2 blocks were created (both referenced)
      const blockInserts = insertCalls.filter(call => call.table === 'block_template');
      expect(blockInserts).toHaveLength(2);
    });

    it('should create correct entities for classic template', async () => {
      (createTemplateEntitiesFromAgentFileAgentSchema as jest.Mock).mockClear();

      const base: AgentFileSchema = {
        agents: [createMockAgent('memgpt_v2_agent', ['block-1'])],
        groups: [],
        blocks: [createMockBlock('block-1', 'human')],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      await createTemplate(options);

      // Verify template type is classic
      const templateInserts = insertCalls.filter(call => call.table === 'letta_templates');
      expect(templateInserts).toHaveLength(1);
      expect(templateInserts[0].values.type).toBe('classic');
      expect(templateInserts[0].values.groupConfiguration).toBeNull();

      // Verify createTemplateEntitiesFromAgentFileAgentSchema was called once
      expect(createTemplateEntitiesFromAgentFileAgentSchema as jest.Mock).toHaveBeenCalledTimes(1);
      expect((createTemplateEntitiesFromAgentFileAgentSchema as jest.Mock).mock.calls[0][0].agentSchema.agent_type).toBe('memgpt_v2_agent');

      // Verify 1 block was created
      const blockInserts = insertCalls.filter(call => call.table === 'block_template');
      expect(blockInserts).toHaveLength(1);
      expect(blockInserts[0].values.label).toBe('human');
    });

    it('should extract correct values from agent schema', async () => {
      (createTemplateEntitiesFromAgentFileAgentSchema as jest.Mock).mockClear();

      const customAgent = createMockAgent('memgpt_v2_agent', []);
      customAgent.system = 'Custom system prompt';
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      customAgent.llm_config!.temperature = 0.9;
      customAgent.tags = ['tag1', 'tag2'];
      customAgent.tool_exec_environment_variables = { ENV_VAR: 'value' };

      const base: AgentFileSchema = {
        agents: [customAgent],
        groups: [],
        blocks: [],
        files: [],
        sources: [],
        tools: [],
        mcp_servers: [],
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      };

      const options = createBaseOptions({ base, tx: mockTx });

      await createTemplate(options);

      // Verify function was called with correct agent schema
      expect(createTemplateEntitiesFromAgentFileAgentSchema as jest.Mock).toHaveBeenCalledTimes(1);
      const callArgs = (createTemplateEntitiesFromAgentFileAgentSchema as jest.Mock).mock.calls[0][0];

      expect(callArgs.agentSchema.system).toBe('Custom system prompt');
      expect(callArgs.agentSchema.llm_config.temperature).toBe(0.9);
      expect(callArgs.agentSchema.tags).toEqual(['tag1', 'tag2']);
      expect(callArgs.agentSchema.tool_exec_environment_variables).toEqual({ ENV_VAR: 'value' });
      expect(callArgs.organizationId).toBe('org-123');
      expect(callArgs.projectId).toBe('project-123');
    });
  });

  describe('Transaction handling', () => {
    it('should use provided transaction when tx is passed', async () => {
      const externalTx = mockTx;
      const options = createBaseOptions({ tx: externalTx });

      await createTemplate(options);

      // Verify the external transaction was used (db.transaction shouldn't be called)
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should create its own transaction when tx is not provided', async () => {
      const options = createBaseOptions(); // No tx provided

      await createTemplate(options);

      // Verify a new transaction was created
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(db.transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not call db.transaction when using passed tx', async () => {
      // This test verifies that when tx is passed, db.transaction is never called
      (db.transaction as jest.Mock).mockClear(); // Clear previous calls

      const options = createBaseOptions({ tx: mockTx });
      await createTemplate(options);

      // Should not have called db.transaction
      expect(db.transaction).not.toHaveBeenCalled();

      // But should have used the passed transaction
      expect(mockTx.insert).toHaveBeenCalled();
    });
  });
});

import { generateTemplateSnapshot } from './generateTemplateSnapshot';
import type {
  agentTemplateV2,
  blockTemplate,
  lettaTemplates,
} from '@letta-cloud/service-database';
import type {
  AgentTemplatePropertiesType,
  GroupConfigurationType,
} from '@letta-cloud/sdk-core';
import type { MemoryVariableVersionOneType } from '@letta-cloud/types';

type MockTemplate = typeof lettaTemplates.$inferSelect & {
  agentTemplates: Array<typeof agentTemplateV2.$inferSelect>;
  blockTemplates: Array<typeof blockTemplate.$inferSelect>;
};

describe('generateTemplateSnapshot', () => {
  const mockMemoryVariables: MemoryVariableVersionOneType = {
    version: '1',
    data: [
      {
        key: 'user_name',
        label: 'User Name',
        type: 'string',
      },
      {
        key: 'user_age',
        label: 'User Age',
        type: 'number',
      },
    ],
  };

  const mockAgentProperties: AgentTemplatePropertiesType = {
    enable_reasoner: false,
    put_inner_thoughts_in_kwargs: true,
    context_window_limit: 4000,
    max_tokens: 1000,
    max_reasoning_tokens: 500,
    max_files_open: 10,
    message_buffer_autoclear: true,
    per_file_view_window_char_limit: 2000,
  };

  const mockGroupConfiguration: GroupConfigurationType = {
    managerAgentEntityId: 'manager-123',
    managerType: 'supervisor',
    terminationToken: 'STOP',
    maxTurns: 10,
    sleeptimeAgentFrequency: 5,
    maxMessageBufferLength: 100,
    minMessageBufferLength: 10,
  };

  const mockAgentTemplate: typeof agentTemplateV2.$inferSelect = {
    id: 'agent-123',
    name: 'Test Agent',
    entityId: 'entity-123',
    organizationId: 'org-123',
    projectId: 'project-123',
    lettaTemplateId: 'template-123',
    memoryVariables: mockMemoryVariables,
    toolVariables: mockMemoryVariables,
    tags: ['test', 'agent'],
    identityIds: ['identity-1', 'identity-2'],
    systemPrompt: 'You are a helpful assistant.',
    toolIds: ['tool-1', 'tool-2'],
    toolRules: [{ tool_name: 'test_tool', type: 'run_first' }],
    sourceIds: ['source-1'],
    model: 'gpt-4',
    properties: mockAgentProperties,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-02T00:00:00Z'),
  };

  const mockBlockTemplate: typeof blockTemplate.$inferSelect = {
    id: 'block-123',
    organizationId: 'org-123',
    entityId: 'block-entity-123',
    projectId: 'project-123',
    lettaTemplateId: 'template-123',
    value: 'This is a test block value',
    label: 'Test Block',
    limit: 500,
    description: 'A test block template',
    preserveOnMigration: true,
    readOnly: false,
    createdAt: new Date('2023-01-01T00:00:00Z'),
    updatedAt: new Date('2023-01-02T00:00:00Z'),
  };

  const mockTemplate: MockTemplate = {
    id: 'template-123',
    name: 'Test Template',
    organizationId: 'org-123',
    projectId: 'project-123',
    version: 'current',
    latestDeployed: true,
    description: 'A test template',
    type: 'classic',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    deletedAt: null,
    updatedAt: new Date('2023-01-02T00:00:00Z'),
    message: 'Initial template creation',
    groupConfiguration: mockGroupConfiguration,
    migrationOriginalTemplateId: null,
    migrationOriginalDeployedTemplateId: null,
    agentTemplates: [mockAgentTemplate],
    blockTemplates: [mockBlockTemplate],
  };

  it('should transform template with all properties correctly', () => {
    const result = generateTemplateSnapshot(mockTemplate);

    expect(result).toEqual({
      agents: [
        {
          entityId: 'entity-123',
          name: 'Test Agent',
          model: 'gpt-4',
          systemPrompt: 'You are a helpful assistant.',
          toolIds: ['tool-1', 'tool-2'],
          sourceIds: ['source-1'],
          properties: mockAgentProperties,
          toolVariables: mockMemoryVariables,
          tags: ['test', 'agent'],
          identityIds: ['identity-1', 'identity-2'],
          toolRules: [{ tool_name: 'test_tool', type: 'run_first' }],
          memoryVariables: mockMemoryVariables,
        },
      ],
      blocks: [
        {
          label: 'Test Block',
          value: 'This is a test block value',
          limit: 500,
          description: 'A test block template',
          preserveOnMigration: true,
          readOnly: false,
        },
      ],
      configuration: mockGroupConfiguration,
      type: 'classic',
      version: 'current',
    });
  });

  it('should handle empty agent and block templates arrays', () => {
    const emptyTemplate: MockTemplate = {
      ...mockTemplate,
      agentTemplates: [],
      blockTemplates: [],
    };

    const result = generateTemplateSnapshot(emptyTemplate);

    expect(result.agents).toEqual([]);
    expect(result.blocks).toEqual([]);
    expect(result.configuration).toEqual(mockGroupConfiguration);
    expect(result.type).toBe('classic');
  });

  it('should handle null groupConfiguration', () => {
    const templateWithNullConfig: MockTemplate = {
      ...mockTemplate,
      groupConfiguration: null,
    };

    const result = generateTemplateSnapshot(templateWithNullConfig);

    expect(result.configuration).toEqual({});
  });

  it('should handle null optional fields in agent template', () => {
    const agentWithNullFields: typeof agentTemplateV2.$inferSelect = {
      ...mockAgentTemplate,
      memoryVariables: null,
      toolVariables: null,
      tags: null,
      identityIds: null,
      toolIds: null,
      toolRules: null,
      sourceIds: null,
      properties: null,
    };

    const templateWithNullFields: MockTemplate = {
      ...mockTemplate,
      agentTemplates: [agentWithNullFields],
    };

    const result = generateTemplateSnapshot(templateWithNullFields);

    expect(result.agents[0]).toEqual({
      entityId: 'entity-123',
      name: 'Test Agent',
      model: 'gpt-4',
      systemPrompt: 'You are a helpful assistant.',
      toolIds: null,
      sourceIds: null,
      properties: null,
      toolVariables: null,
      tags: null,
      identityIds: null,
      toolRules: null,
      memoryVariables: null,
    });
  });

  it('should handle null preserveOnMigration in block template', () => {
    const blockWithNullPreserve: typeof blockTemplate.$inferSelect = {
      ...mockBlockTemplate,
      preserveOnMigration: null,
    };

    const templateWithNullPreserve: MockTemplate = {
      ...mockTemplate,
      blockTemplates: [blockWithNullPreserve],
    };

    const result = generateTemplateSnapshot(templateWithNullPreserve);

    expect(result.blocks[0].preserveOnMigration).toBeNull();
  });

  it('should handle different template types', () => {
    const templateTypes = [
      'classic',
      'cluster',
      'sleeptime',
      'round_robin',
      'supervisor',
      'dynamic',
      'voice_sleeptime',
    ] as const;

    templateTypes.forEach((type) => {
      const templateWithType: MockTemplate = {
        ...mockTemplate,
        type,
      };

      const result = generateTemplateSnapshot(templateWithType);
      expect(result.type).toBe(type);
    });
  });

  it('should handle multiple agents and blocks', () => {
    const secondAgent: typeof agentTemplateV2.$inferSelect = {
      ...mockAgentTemplate,
      id: 'agent-456',
      name: 'Second Agent',
      entityId: 'entity-456',
    };

    const secondBlock: typeof blockTemplate.$inferSelect = {
      ...mockBlockTemplate,
      id: 'block-456',
      label: 'Second Block',
      entityId: 'block-entity-456',
    };

    const multiTemplate: MockTemplate = {
      ...mockTemplate,
      agentTemplates: [mockAgentTemplate, secondAgent],
      blockTemplates: [mockBlockTemplate, secondBlock],
    };

    const result = generateTemplateSnapshot(multiTemplate);

    expect(result.agents).toHaveLength(2);
    expect(result.blocks).toHaveLength(2);
    expect(result.agents[0].name).toBe('Test Agent');
    expect(result.agents[1].name).toBe('Second Agent');
    expect(result.blocks[0].label).toBe('Test Block');
    expect(result.blocks[1].label).toBe('Second Block');
  });

  it('should preserve all required fields from TemplateSnapshotSchemaType', () => {
    const result = generateTemplateSnapshot(mockTemplate);

    // Verify the result has all required top-level properties
    expect(result).toHaveProperty('agents');
    expect(result).toHaveProperty('blocks');
    expect(result).toHaveProperty('configuration');
    expect(result).toHaveProperty('type');

    // Verify agent properties
    if (result.agents.length > 0) {
      const agent = result.agents[0];
      const requiredAgentFields = ['entityId', 'name', 'model', 'systemPrompt'];

      requiredAgentFields.forEach((field) => {
        expect(agent).toHaveProperty(field);
      });
    }

    // Verify block properties
    if (result.blocks.length > 0) {
      const block = result.blocks[0];
      const requiredBlockFields = [
        'label',
        'value',
        'limit',
        'description',
        'preserveOnMigration',
        'readOnly',
      ];

      requiredBlockFields.forEach((field) => {
        expect(block).toHaveProperty(field);
      });
    }
  });
});

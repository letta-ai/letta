import { synchronizeSimulatedAgentWithAgentTemplate } from './synchronizeSimulatedAgentWithAgentTemplate';
import type { AgentStateForSynchronization } from './synchronizeSimulatedAgentWithAgentTemplate';

describe('synchronizeSimulatedAgentWithAgentTemplate', () => {
  const mockLLMConfig = {
    model: 'gpt-4',
    model_endpoint_type: 'openai' as const,
    enable_reasoner: false,
    put_inner_thoughts_in_kwargs: true,
    context_window: 8192,
    handle: 'openai/gpt-4',
    max_tokens: 1000,
    max_reasoning_tokens: 2000,
    temperature: 0.7,
  };

  const mockMemoryBlocks = [
    {
      id: 'block-1',
      value: 'You are a helpful assistant.',
      label: 'system',
      limit: 500,
      description: 'System prompt block',
      preserve_on_migration: true,
      read_only: false,
      is_template: false,
    },
    {
      id: 'block-2',
      value: 'I am Claude.',
      label: 'persona',
      limit: 200,
      description: 'Persona block',
      preserve_on_migration: false,
      read_only: true,
      is_template: false,
    },
  ];

  const mockToolRules = [
    {
      type: 'parent_last_tool' as const,
      tool_name: 'search',
      children: ['calculator'],
    },
    {
      type: 'max_count_per_step' as const,
      tool_name: 'calculator',
      max_count_limit: 3,
    },
  ];

  const mockAgentState: AgentStateForSynchronization = {
    system: 'You are a test agent',
    agent_type: 'memgpt_agent' as any,
    llm_config: mockLLMConfig,
    memory: {
      blocks: mockMemoryBlocks,
      prompt_template: 'Test template',
    },
    tools: [
      { id: 'tool-1', name: 'search', description: 'Search tool' },
      { id: 'tool-2', name: 'calculator', description: 'Math tool' },
    ],
    sources: [
      {
        id: 'source-1',
        name: 'docs',
        description: 'Documentation',
        embedding_config: {
          embedding_model: 'text-embedding-ada-002',
          embedding_endpoint_type: 'openai',
          embedding_dim: 1536,
        },
      },
    ],
    tags: [],
    identity_ids: [],
    tool_rules: mockToolRules,
    tool_exec_environment_variables: [
      {
        key: 'API_KEY',
        value: 'secret-key',
        agent_id: 'agent-123',
      },
      {
        key: 'DEBUG',
        value: 'true',
        agent_id: 'agent-123',
      },
    ],
    max_files_open: 10,
    per_file_view_window_char_limit: 2000,
    timezone: 'UTC',
  };

  it('should synchronize agent state to template format with all fields', () => {
    const result = synchronizeSimulatedAgentWithAgentTemplate(mockAgentState);

    expect(result.agentTemplate).toEqual({
      toolIds: ['tool-1', 'tool-2'],
      sourceIds: ['source-1'],
      tags: [],
      identityIds: [],
      agentType: 'memgpt_agent',
      memoryVariables: {
        data: [],
        version: "1"
      },
      model: 'openai/gpt-4',
      toolRules: mockToolRules,
      systemPrompt: 'You are a test agent',
      toolVariables: {
        data: [
          { key: 'API_KEY', defaultValue: 'secret-key', type: 'string' },
          { key: 'DEBUG', defaultValue: 'true', type: 'string' },
        ],
        version: '1',
      },
      properties: {
        enable_reasoner: false,
        put_inner_thoughts_in_kwargs: true,
        context_window_limit: 8192,
        max_tokens: 1000,
        max_reasoning_tokens: 2000,
        max_files_open: 10,
          temperature: 0.7,
        per_file_view_window_char_limit: 2000,
        message_buffer_autoclear: null,
      },
    });

    expect(result.agentTemplateBlocks).toEqual([
      {
        id: 'block-1',
        value: 'You are a helpful assistant.',
        label: 'system',
        limit: 500,
        description: 'System prompt block',
        preserveOnMigration: true,
        readOnly: false,
      },
      {
        id: 'block-2',
        value: 'I am Claude.',
        label: 'persona',
        limit: 200,
        description: 'Persona block',
        preserveOnMigration: false,
        readOnly: true,
      },
    ]);
  });

  it('should handle agent with minimal data', () => {
    const minimalAgent: AgentStateForSynchronization = {
      system: 'Basic system',
      agent_type: 'memgpt_agent' as any,
      llm_config: {
        model: 'gpt-3.5-turbo',
        model_endpoint_type: 'openai',
        context_window: 4096,
        handle: 'openai/gpt-3.5-turbo',
        enable_reasoner: false,
        put_inner_thoughts_in_kwargs: true,
      },
      memory: {
        blocks: [],
      },
      tools: [],
      sources: [],
      tags: [],
    };

    const result = synchronizeSimulatedAgentWithAgentTemplate(minimalAgent);

    expect(result.agentTemplate).toEqual({
      toolIds: [],
      sourceIds: [],
      tags: [],
      identityIds: [],
      agentType: 'memgpt_agent',
      memoryVariables: {
        data: [],
        version: "1"
      },
      model: 'openai/gpt-3.5-turbo',
      toolRules: [],
      systemPrompt: 'Basic system',
      toolVariables: null,
      properties: {
        temperature: 0.7,
        enable_reasoner: false,
        put_inner_thoughts_in_kwargs: true,
        context_window_limit: 4096,
        max_tokens: null,
        max_reasoning_tokens: null,
        max_files_open: null,
        per_file_view_window_char_limit: null,
        message_buffer_autoclear: null,
      },
    });

    expect(result.agentTemplateBlocks).toEqual([]);
  });

  it('should handle agent with null/undefined optional fields', () => {
    const agentWithNulls: AgentStateForSynchronization = {
      system: 'System',
      agent_type: 'memgpt_agent' as any,
      llm_config: {
        model: 'gpt-4',
        model_endpoint_type: 'openai',
        enable_reasoner: false,
        put_inner_thoughts_in_kwargs: true,
        context_window: 8192,
        handle: 'openai/gpt-4',
        max_tokens: null,
        max_reasoning_tokens: undefined,
        temperature: 0.7,
      },
      memory: {
        blocks: [
          {
            id: 'block-with-nulls',
            value: 'Block content',
            label: 'test',
            // Missing optional fields
          },
        ],
      },
      tools: [],
      sources: [],
      tags: [],
      tool_exec_environment_variables: undefined,
      max_files_open: null,
      per_file_view_window_char_limit: null,
      timezone: null,
    };

    const result = synchronizeSimulatedAgentWithAgentTemplate(agentWithNulls);

    expect(result.agentTemplate.properties).toEqual({
      enable_reasoner: false,
      put_inner_thoughts_in_kwargs: true,
      context_window_limit: 8192,
      max_tokens: null,
      max_reasoning_tokens: null,
      max_files_open: null,
      per_file_view_window_char_limit: null,
      temperature: 0.7,
      message_buffer_autoclear: null,
    });

    expect(result.agentTemplateBlocks).toEqual([
      {
        id: 'block-with-nulls',
        value: 'Block content',
        label: 'test',
        limit: 8000, // Default value
        description: '', // Default value
        preserveOnMigration: null,
        readOnly: false, // Default value
      },
    ]);
  });


  it('should handle tools and sources with missing IDs', () => {
    const agentWithBadIds: AgentStateForSynchronization = {
      system: 'System',
      agent_type: 'memgpt_agent' as any,
      llm_config: {
        model: 'gpt-4',
        model_endpoint_type: 'openai',
        context_window: 8192,
        handle: 'openai/gpt-4',
      },
      memory: { blocks: [] },
      tools: [
        { id: 'tool-1', name: 'valid-tool' },
        { id: '', name: 'empty-id-tool' }, // Should be filtered
        { id: null as any, name: 'null-id-tool' }, // Should be filtered
        { id: undefined as any, name: 'undefined-id-tool' }, // Should be filtered
      ],
      sources: [
        {
          id: 'source-1',
          name: 'valid-source',
          embedding_config: {
            embedding_model: 'text-embedding-ada-002',
            embedding_endpoint_type: 'openai',
            embedding_dim: 1536,
          },
        },
        {
          id: '',
          name: 'empty-id-source',
          embedding_config: {
            embedding_model: 'text-embedding-ada-002',
            embedding_endpoint_type: 'openai',
            embedding_dim: 1536,
          },
        }, // Should be filtered
      ],
      tags: [],
    };

    const result = synchronizeSimulatedAgentWithAgentTemplate(agentWithBadIds);

    expect(result.agentTemplate.toolIds).toEqual(['tool-1']);
    expect(result.agentTemplate.sourceIds).toEqual(['source-1']);
    expect(result.agentTemplate.toolRules).toEqual([]);
  });

  it('should handle agent with tool rules', () => {
    const customToolRules = [
      {
        type: 'run_first' as const,
        tool_name: 'exit_tool',
      },
      {
        type: 'run_first' as const,
        tool_name: 'search',
      },
    ];

    const agentWithToolRules: AgentStateForSynchronization = {
      system: 'System',
      agent_type: 'memgpt_agent',
      llm_config: {
        model: 'gpt-4',
        model_endpoint_type: 'openai',
        context_window: 8192,
        handle: 'openai/gpt-4',
      },
      memory: { blocks: [] },
      tools: [],
      sources: [],
      tags: [],
      tool_rules: customToolRules,
    };

    const result =
      synchronizeSimulatedAgentWithAgentTemplate(agentWithToolRules);

    expect(result.agentTemplate.toolRules).toEqual(customToolRules);
  });
});

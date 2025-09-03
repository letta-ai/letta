import type { UpdateAgent } from '@letta-cloud/sdk-core';
import type { AgentTemplateStateWithNoMetadata } from '@letta-cloud/utils-shared';
import { mapAllAgentTemplatePropertiesToUpdateAgent } from './mapAllAgentTemplatePropertiesToUpdateAgent';

describe('mapAllAgentTemplatePropertiesToUpdateAgent', () => {
  // Define properties that are explicitly ignored (not mapped to UpdateAgent)
  const EXPLICITLY_IGNORED_PROPERTIES = new Set([
    'toolVariables', // No equivalent in UpdateAgent
  ]);

  // Define properties that are mapped from AgentTemplateState to UpdateAgent
  const MAPPED_PROPERTIES = new Set([
    'tags',
    'toolIds',
    'sourceIds',
    'toolRules',
    'systemPrompt',
    'identityIds',
    'memoryVariables',
    'model',
    'agentType',
    'properties', // Contains nested properties that get mapped individually
  ]);

  // Define nested properties within 'properties' that are mapped
  const MAPPED_NESTED_PROPERTIES = new Set([
    'max_files_open',
    'per_file_view_window_char_limit',
    'message_buffer_autoclear',
    'temperature',
  ]);

  // Define nested properties within 'properties' that are explicitly ignored
  const EXPLICITLY_IGNORED_NESTED_PROPERTIES = new Set([
    'context_window_limit', // No equivalent in UpdateAgent
    'max_tokens', // No equivalent in UpdateAgent
    'max_reasoning_tokens', // No equivalent in UpdateAgent
    'enable_reasoner', // Different from 'reasoning' field
    'put_inner_thoughts_in_kwargs', // Different from 'reasoning' field
    'timezone',
    'reasoning',
  ]);

  // Define UpdateAgent properties that can be mapped from AgentTemplateState
  const UPDATE_AGENT_MAPPABLE_PROPERTIES = new Set([
    'tags',
    'tool_ids',
    'source_ids',
    'tool_rules',
    'identity_ids',
    'model',
    'timezone',
    'max_files_open',
    'per_file_view_window_char_limit',
    'reasoning',
    'temperature',
  ]);

  // Define UpdateAgent properties that cannot be mapped from AgentTemplateState
  const UPDATE_AGENT_NON_MAPPABLE_PROPERTIES = new Set([
    'name', // Not available in AgentTemplateState
    'block_ids', // Not available in AgentTemplateState
    'system', // Not available in AgentTemplateState
    'llm_config', // Not available in AgentTemplateState
    'embedding_config', // Not available in AgentTemplateState
    'message_ids', // Not available in AgentTemplateState
    'description', // Not available in AgentTemplateState
    'metadata', // Not available in AgentTemplateState
    'tool_exec_environment_variables', // Not available in AgentTemplateState
    'project_id', // Not available in AgentTemplateState
    'template_id', // Not available in AgentTemplateState
    'base_template_id', // Not available in AgentTemplateState
    'message_buffer_autoclear', // Not available in AgentTemplateState
    'embedding', // Not available in AgentTemplateState
    'enable_sleeptime', // Not available in AgentTemplateState
    'response_format', // Not available in AgentTemplateState
    'last_run_completion', // Runtime data, not template data
    'last_run_duration_ms', // Runtime data, not template data
    'hidden', // Not available in AgentTemplateState
  ]);

  it('should ensure all AgentTemplateState properties are explicitly handled', () => {
    // Create a mock AgentTemplateState with all possible properties
    const mockAgentTemplate: AgentTemplateStateWithNoMetadata = {
      agentType: 'memgpt_v2_agent',
      toolVariables: {
        version: '1',
        data: [
          {
            defaultValue: 'test',
            type: 'string',
            key: 'value1',
          },
        ],
      },
      memoryVariables: {
        version: '1',
        data: [

        ],
      },
      systemPrompt: '',
      tags: ['tag1', 'tag2'],
      toolIds: ['tool1', 'tool2'],
      sourceIds: ['source1', 'source2'],
      toolRules: [{ tool_name: 'test_tool', type: 'run_first' }],
      identityIds: ['identity1', 'identity2'],
      model: 'gpt-4',
      properties: {
        enable_reasoner: false,
        temperature: 0.7,
        put_inner_thoughts_in_kwargs: true,
        message_buffer_autoclear: true,
        max_files_open: 10,
        per_file_view_window_char_limit: 1000,
        context_window_limit: 8000,
        max_tokens: 2000,
        max_reasoning_tokens: 1000,
      },
    };

    // Get all top-level properties from the mock
    const allProperties = Object.keys(mockAgentTemplate) as Array<
      keyof AgentTemplateStateWithNoMetadata
    >;

    // Check that every top-level property is either mapped or explicitly ignored
    for (const property of allProperties) {
      const isHandled =
        MAPPED_PROPERTIES.has(property) ||
        EXPLICITLY_IGNORED_PROPERTIES.has(property);

      if (!isHandled) {
        throw new Error(
          `Property '${property}' is not explicitly handled. ` +
            `Add it to either MAPPED_PROPERTIES or EXPLICITLY_IGNORED_PROPERTIES in the test.`,
        );
      }
      expect(isHandled).toBe(true);
    }

    // If properties object exists, check all its nested properties
    if (mockAgentTemplate.properties) {
      const allNestedProperties = Object.keys(mockAgentTemplate.properties);

      for (const nestedProperty of allNestedProperties) {
        const isHandled =
          MAPPED_NESTED_PROPERTIES.has(nestedProperty) ||
          EXPLICITLY_IGNORED_NESTED_PROPERTIES.has(nestedProperty);

        if (!isHandled) {
          throw new Error(
            `Nested property 'properties.${nestedProperty}' is not explicitly handled. ` +
              `Add it to either MAPPED_NESTED_PROPERTIES or EXPLICITLY_IGNORED_NESTED_PROPERTIES in the test.`,
          );
        }
        expect(isHandled).toBe(true);
      }
    }
  });

  it.skip('should ensure all UpdateAgent properties are explicitly categorized', () => {
    // Get all known UpdateAgent properties by combining our categorized sets
    const allKnownProperties = new Set([
      ...UPDATE_AGENT_MAPPABLE_PROPERTIES,
      ...UPDATE_AGENT_NON_MAPPABLE_PROPERTIES,
    ]);

    // This is a compile-time check: if UpdateAgent gets new properties,
    // TypeScript will require them to be handled in this comprehensive object
    const typeCheckObject: Required<UpdateAgent> = {
      name: null,
      tool_ids: null,
      source_ids: null,
      block_ids: null,
      tags: null,
      system: null,
      tool_rules: null,
      llm_config: null,
      embedding_config: null,
      message_ids: null,
      description: null,
      metadata: null,
      tool_exec_environment_variables: null,
      project_id: null,
      template_id: null,
      base_template_id: null,
      identity_ids: null,
      message_buffer_autoclear: null,
      model: null,
      embedding: null,
      reasoning: null,
      enable_sleeptime: null,
      response_format: null,
      last_run_completion: null,
      last_run_duration_ms: null,
      timezone: null,
      max_files_open: null,
      per_file_view_window_char_limit: null,
      hidden: null,
    };

    // Get all properties from the comprehensive object
    const actualUpdateAgentProperties = Object.keys(typeCheckObject) as Array<
      keyof UpdateAgent
    >;

    // Check that our known properties set matches the actual UpdateAgent properties
    const actualPropertiesSet = new Set(actualUpdateAgentProperties);

    // Find any properties in the actual type that we haven't categorized
    const uncategorizedProperties = actualUpdateAgentProperties.filter(
      (prop) => !allKnownProperties.has(prop),
    );

    // Find any properties we've categorized that don't exist in the actual type
    const overCategorizedProperties = Array.from(allKnownProperties).filter(
      (prop) => !actualPropertiesSet.has(prop as keyof UpdateAgent),
    );

    if (uncategorizedProperties.length > 0) {
      throw new Error(
        `New UpdateAgent properties found that are not categorized: ${uncategorizedProperties.join(', ')}. ` +
          `Add them to either UPDATE_AGENT_MAPPABLE_PROPERTIES or UPDATE_AGENT_NON_MAPPABLE_PROPERTIES in the test.`,
      );
    }

    if (overCategorizedProperties.length > 0) {
      throw new Error(
        `Properties categorized in test but not found in UpdateAgent type: ${overCategorizedProperties.join(', ')}. ` +
          `Remove them from the property sets in the test.`,
      );
    }

    expect(uncategorizedProperties).toHaveLength(0);
    expect(overCategorizedProperties).toHaveLength(0);
  });

  it('should map all expected properties correctly', () => {
    const mockAgentTemplate: AgentTemplateStateWithNoMetadata = {
      agentType: 'memgpt_v2_agent',
      toolVariables: {
        version: '1',
        data: [
          {
            defaultValue: 'test',
            type: 'string',
            key: 'value1',
          },
        ],
      },
      memoryVariables: {
        version: '1',
        data: [

        ],
      },
      systemPrompt: '',
      tags: ['tag1', 'tag2'],
      toolIds: ['tool1', 'tool2'],
      sourceIds: ['source1', 'source2'],
      toolRules: [{ tool_name: 'test_tool', type: 'run_first' }],
      identityIds: ['identity1', 'identity2'],
      model: 'gpt-4',
      properties: {
        enable_reasoner: false,
        temperature: 0.7,
        put_inner_thoughts_in_kwargs: true,
        message_buffer_autoclear: true,
        max_files_open: 10,
        per_file_view_window_char_limit: 1000,
        context_window_limit: 8000,
        max_tokens: 2000,
        max_reasoning_tokens: 1000,
      },
    };

    const result =
      mapAllAgentTemplatePropertiesToUpdateAgent(mockAgentTemplate);

    // Verify mapped properties
    expect(result.tags).toEqual(['tag1', 'tag2']);
    expect(result.tool_ids).toEqual(['tool1', 'tool2']);
    expect(result.source_ids).toEqual(['source1', 'source2']);
    expect(result.tool_rules).toEqual([{ tool_name: 'test_tool', type: 'run_first' }]);
    expect(result.identity_ids).toEqual(['identity1', 'identity2']);
    expect(result.model).toBe('gpt-4');
    expect(result.max_files_open).toBe(10);
    expect(result.per_file_view_window_char_limit).toBe(1000);

    // Verify ignored properties are not included
    expect(result).not.toHaveProperty('toolVariables');
    expect(result).not.toHaveProperty('context_window_limit');
    expect(result).not.toHaveProperty('max_tokens');
    expect(result).not.toHaveProperty('max_reasoning_tokens');
    expect(result).not.toHaveProperty('enable_reasoner');
    expect(result).not.toHaveProperty('reasoning');
    expect(result).not.toHaveProperty('timezone');

  });
});

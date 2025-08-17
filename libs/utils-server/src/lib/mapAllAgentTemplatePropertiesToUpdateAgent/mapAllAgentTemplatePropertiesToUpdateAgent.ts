import type { UpdateAgent } from '@letta-cloud/sdk-core';
import type { AgentTemplateStateWithNoMetadata } from '@letta-cloud/utils-shared';
import { convertMemoryVariablesV1ToRecordMemoryVariables } from '@letta-cloud/utils-shared';

export function mapAllAgentTemplatePropertiesToUpdateAgent(
  agentTemplate: AgentTemplateStateWithNoMetadata,
): UpdateAgent {
  const updateAgent: UpdateAgent = {};

  // Map basic properties if they exist
  if (agentTemplate.tags) {
    updateAgent.tags = agentTemplate.tags;
  }

  if (agentTemplate.toolIds) {
    updateAgent.tool_ids = agentTemplate.toolIds;
  }

  if (agentTemplate.sourceIds) {
    updateAgent.source_ids = agentTemplate.sourceIds;
  }

  if (agentTemplate.toolRules) {
    updateAgent.tool_rules = agentTemplate.toolRules;
  }

  if (agentTemplate.identityIds) {
    updateAgent.identity_ids = agentTemplate.identityIds;
  }

  if (agentTemplate.model) {
    updateAgent.model = agentTemplate.model;
  }

  // Map properties from the properties object if they exist

  if (agentTemplate.properties?.max_files_open !== undefined) {
    updateAgent.max_files_open = agentTemplate.properties.max_files_open;
  }

  if (agentTemplate.properties?.per_file_view_window_char_limit !== undefined) {
    updateAgent.per_file_view_window_char_limit =
      agentTemplate.properties.per_file_view_window_char_limit;
  }


  if (agentTemplate.toolVariables) {
    updateAgent.tool_exec_environment_variables =
      convertMemoryVariablesV1ToRecordMemoryVariables(
        agentTemplate.toolVariables,
      );
  }

  if (agentTemplate.properties?.message_buffer_autoclear) {
    updateAgent.message_buffer_autoclear =
      agentTemplate.properties.message_buffer_autoclear;
  }

  if (agentTemplate.systemPrompt) {
    updateAgent.system = agentTemplate.systemPrompt;
  }

  return updateAgent;
}

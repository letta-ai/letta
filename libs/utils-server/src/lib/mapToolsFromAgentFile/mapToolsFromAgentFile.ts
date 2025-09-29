import { ToolsService } from '@letta-cloud/sdk-core';
import type {
  AgentFileSchema,
  letta__schemas__agent_file__AgentSchema,
  ToolCreate,
  Tool
} from '@letta-cloud/sdk-core';

interface MapToolsFromAgentFileOptions {
  base: AgentFileSchema;
  lettaAgentsId: string;
  updateExistingTools?: boolean;
}

interface ToolMapping {
  [originalToolId: string]: string; // Maps from agent file tool ID to server tool ID
}


/**
 * Extracts all tool names from the agents in the AgentFileSchema
 */
export function extractToolNamesFromAgentFile(base: AgentFileSchema): string[] {
  const toolNames = new Set<string>();

  // Extract tool names from tools array
  if (base.tools) {
    for (const tool of base.tools) {
      if (tool.name) {
        toolNames.add(tool.name);
      }
    }
  }

  return Array.from(toolNames);
}

/**
 * Creates a mapping from agent file tool IDs to server tool IDs.
 * Creates missing tools on the server if they don't exist.
 */
export async function mapToolsFromAgentFile(
  options: MapToolsFromAgentFileOptions
): Promise<ToolMapping> {
  const { base, lettaAgentsId, updateExistingTools = false } = options;

  if (!base.tools?.length) {
    return {};
  }

  // Extract tool names from the agent file
  const toolNames = extractToolNamesFromAgentFile(base);

  if (toolNames.length === 0) {
    return {};
  }

  // Query existing tools by names
  const existingToolsResponse = await ToolsService.listTools({
    names: toolNames,
  }, { user_id: lettaAgentsId });

  // Create a map from tool name to server tool ID and full tool objects for updates
  const nameToServerToolId: Record<string, string> = {};
  const nameToServerTool: Record<string, Tool> = {};
  for (const tool of existingToolsResponse) {
    if (tool.name && tool.id) {
      nameToServerToolId[tool.name] = tool.id;
      nameToServerTool[tool.name] = tool;
    }
  }

  // Find missing tools that need to be created
  const missingToolNames = toolNames.filter(name => !nameToServerToolId[name]);
  const toolsToCreate = base.tools.filter(tool =>
    tool.name && missingToolNames.includes(tool.name)
  );

  // Create missing tools in parallel
  const toolCreationPromises = toolsToCreate
    .filter(tool => tool.name && tool.source_code)
    .map(async (tool) => {
      const toolCreateData: ToolCreate = {
        source_code: tool.source_code || '',
        source_type: tool.source_type || 'python',
        description: tool.description || undefined,
        tags: tool.tags || undefined,
        json_schema: tool.json_schema,
      };

      const createdTool = await ToolsService.createTool({
        requestBody: toolCreateData,
      }, { user_id: lettaAgentsId });

      return { toolName: tool?.name || '', createdTool };
    });

  const createdToolResults = await Promise.all(toolCreationPromises);

  // Update the mapping with created tools
  for (const { toolName, createdTool } of createdToolResults) {
    if (createdTool.id) {
      nameToServerToolId[toolName] = createdTool.id;
    }
  }

  // Update existing tools if requested
  if (updateExistingTools) {
    const existingToolNames = toolNames.filter(name => nameToServerToolId[name]);
    const toolsToUpdate = base.tools.filter(tool =>
      tool.name && existingToolNames.includes(tool.name) && tool.tool_type === 'custom'
    );

    const toolUpdatePromises = toolsToUpdate.map(async (agentFileTool) => {
      if (!agentFileTool.name) return;

      const existingTool = nameToServerTool[agentFileTool.name];
      const toolId = nameToServerToolId[agentFileTool.name];

      if (!existingTool || !toolId) return;

      // Prevent source_type changes
      if (agentFileTool.source_type && agentFileTool.source_type !== existingTool.source_type) {
        throw new Error(`Cannot change source_type for existing tool '${agentFileTool.name}' from '${existingTool.source_type}' to '${agentFileTool.source_type}'`);
      }

      // Only update source_code and json_schema, preserve other fields including source_type
      const updateData = {
        source_code: agentFileTool.source_code || existingTool.source_code,
        json_schema: agentFileTool.json_schema || existingTool.json_schema,
        // Keep existing values for fields we don't want to change
        source_type: existingTool.source_type,
        description: existingTool.description,
        tags: existingTool.tags,
      };

      await ToolsService.modifyTool({
        toolId,
        requestBody: updateData,
      }, { user_id: lettaAgentsId });
    });

    await Promise.all(toolUpdatePromises);
  }

  // Create final mapping from agent file tool ID to server tool ID
  const toolMapping: ToolMapping = {};
  for (const tool of base.tools) {
    if (tool.name && nameToServerToolId[tool.name]) {
      toolMapping[tool.id] = nameToServerToolId[tool.name];
    }
  }

  return toolMapping;
}

/**
 * Maps tool IDs from agent schema tool_ids array using the tool mapping
 */
export function mapAgentToolIds(
  agent: letta__schemas__agent_file__AgentSchema | undefined,
  toolMapping: ToolMapping
): string[] {
  if (!agent?.tool_ids?.length) {
    return [];
  }

  return agent.tool_ids
    .map(toolId => toolMapping[toolId])
    .filter(Boolean); // Remove any unmapped tool IDs
}

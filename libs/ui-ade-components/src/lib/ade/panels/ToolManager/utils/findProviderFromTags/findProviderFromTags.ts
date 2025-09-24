import { isLettaTool, type Tool } from '@letta-cloud/sdk-core';

export function findProviderFromTags(tool: Tool) {
  if (isLettaTool(tool.tool_type)) {
    return 'letta';
  }

  return 'custom';
}

import { isLettaTool, type Tool } from '@letta-cloud/sdk-core';

export function findProviderFromTags(tool: Tool) {
  const tagsToMap = new Set(tool.tags || []);

  if (tagsToMap.has('composio')) {
    return 'composio';
  }

  if (isLettaTool(tool)) {
    return 'letta';
  }

  return 'custom';
}

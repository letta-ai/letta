import pathToRegexp from 'path-to-regexp';

const baseMessagesRoute = pathToRegexp('/v1/agents/:agent_id/messages');
const advancedMessagesRoute = pathToRegexp(
  '/v1/agents/:agent_id/messages/:type(stream|async)',
);

export function getIsCreateMessageRoute(pathname: string): boolean {
  const isBaseRoute = baseMessagesRoute.exec(pathname);
  const isAdvancedRoute = advancedMessagesRoute.exec(pathname);

  return isBaseRoute !== null || isAdvancedRoute !== null;
}

export function getAgentIdFromMessageRoute(pathname: string): string | null {
  const baseMatch = baseMessagesRoute.exec(pathname);
  const advancedMatch = advancedMessagesRoute.exec(pathname);

  if (baseMatch) {
    return baseMatch[1]; // agent_id is the first captured group
  } else if (advancedMatch) {
    return advancedMatch[1]; // agent_id is the first captured group
  }

  return null; // No match found
}

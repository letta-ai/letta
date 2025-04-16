import type {
  AccessPolicyVersionOneType,
  AgentAccessPolicyType,
} from '@letta-cloud/types';
import pathToRegexp from 'path-to-regexp';

export interface AccessResource {
  pathname: string;
  method: string;
}

export interface ValidateAgentPolicyOptions {
  policy: AgentAccessPolicyType;
  resource: AccessResource;
  coreUserId: string;
}

/* we dont actually need to see if the api key owner owns this agent, as that is validated downstream */
export function validateAgentPolicy(
  options: ValidateAgentPolicyOptions,
): boolean {
  const { policy, resource } = options;

  const messageAgentRoute = pathToRegexp('/agents/:agentId/messages');
  const complexMessageAgentRoute = pathToRegexp(
    '/agents/:agentId/messages/:messageId',
  );

  const baseAgentRoute = pathToRegexp('/agents/:agentId');

  const isMessageAgentRoute =
    messageAgentRoute.test(resource.pathname) ||
    complexMessageAgentRoute.test(resource.pathname);
  const isBaseAgentRoute = baseAgentRoute.test(resource.pathname);

  if (isBaseAgentRoute) {
    const agentId = resource.pathname.split('/')[2];
    if (resource.method === 'POST') {
      return policy.access.includes('write_agent') && policy.id === agentId;
    }

    if (resource.method === 'GET') {
      return policy.access.includes('read_agent') && policy.id === agentId;
    }
  }

  if (isMessageAgentRoute) {
    const agentId = resource.pathname.split('/')[2];
    if (resource.method === 'POST') {
      return policy.access.includes('write_messages') && policy.id === agentId;
    }

    if (resource.method === 'GET') {
      return policy.access.includes('read_messages') && policy.id === agentId;
    }
  }

  return false;
}

interface ValidatePolicyOptions {
  policy: AccessPolicyVersionOneType;
  resource: AccessResource;
  coreUserId: string;
}

export function validateClientSidePolicy(options: ValidatePolicyOptions) {
  const { policy, resource } = options;

  if (!policy) {
    return false;
  }

  const { pathname: basePathname, method } = resource;

  // remove /v1 from the pathname
  const pathname = basePathname.replace(/^\/v1/, '');

  if (policy.data.length === 0) {
    return false;
  }

  return policy.data.every((item) => {
    if (item.type !== 'agent') {
      return false;
    }

    return validateAgentPolicy({
      policy: item,
      resource: {
        pathname,
        method,
      },
      coreUserId: options.coreUserId,
    });
  });
}

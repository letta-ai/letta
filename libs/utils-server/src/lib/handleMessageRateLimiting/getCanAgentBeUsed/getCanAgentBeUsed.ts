import { getRedisData } from '@letta-cloud/service-redis';
import { markActiveAgent } from '../../markActiveAgent/markActiveAgent';
import { getActiveBillableAgentsCount } from '@letta-cloud/service-payments';

interface GetIsAgentActiveOptions {
  agentId: string;
  organizationId: string;
  billingPeriodStart: string;
  agentLimit: number;
}

export async function getCanAgentBeUsed(options: GetIsAgentActiveOptions) {
  const { agentId, billingPeriodStart, organizationId, agentLimit } = options;

  const isDeployedAgent = await getRedisData('deployedAgent', {
    agentId,
  });

  if (!isDeployedAgent?.isDeployed) {
    // if its not deployed, it can be used
    return true;
  }

  const activeAgent = await getRedisData('activeAgent', {
    agentId,
  });

  if (activeAgent) {
    // if the agent was active in the last billingPeriodStart and is a billed agent, we can use it
    if (activeAgent.lastActiveAt > new Date(billingPeriodStart).getTime()) {
      if (activeAgent.isBilledAgent) {
        void markActiveAgent({
          organizationId,
          agentId,
          isBilledAgent: true,
        });

        return true;
      }
    }
  }

  let canAgentBeUsed = false;

  const agentCount = await getActiveBillableAgentsCount(organizationId);

  // if the active agent count is less than the agent limit, we can use the agent
  if (agentCount < agentLimit) {
    canAgentBeUsed = true;
  }

  // mark the agent regardless
  void markActiveAgent({
    organizationId,
    agentId,
    isBilledAgent: canAgentBeUsed,
  });

  return canAgentBeUsed;
}

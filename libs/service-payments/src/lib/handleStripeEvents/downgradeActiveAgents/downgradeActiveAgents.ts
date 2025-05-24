import { getCustomerSubscription } from '../../getCustomerSubscription/getCustomerSubscription';
import { getUsageLimits } from '@letta-cloud/utils-shared';
import { db } from '@letta-cloud/service-database';
import { sql } from 'drizzle-orm';
import { getActiveBillableAgentsCount } from '../../getActiveBillableAgentsCount/getActiveBillableAgentsCount';

export async function downgradeActiveAgents(organizationId: string) {
  const subscription = await getCustomerSubscription(organizationId);

  const usageLimits = getUsageLimits(subscription.tier);
  const activeAgentCount = await getActiveBillableAgentsCount(organizationId);

  // if active agents is less than the limit, do nothign
  if (activeAgentCount < usageLimits.agents) {
    console.log('b');
    return;
  }

  const agentsToDowngrade = activeAgentCount - usageLimits.agents;

  db.execute(sql`UPDATE active_agents
                 SET is_billed_agent = false
                 WHERE agent_id IN (SELECT agent_id
                                    FROM (SELECT agent_id
                                          FROM active_agents
                                          WHERE organization_id = ${organizationId}
                                          ORDER BY last_active_at ASC LIMIT ${agentsToDowngrade}) AS subquery);
  `);
}

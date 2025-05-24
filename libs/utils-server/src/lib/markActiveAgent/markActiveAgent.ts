import { activeAgents, db } from '@letta-cloud/service-database';
import { setRedisData } from '@letta-cloud/service-redis';

interface MarkActiveAgentOptions {
  organizationId: string;
  agentId: string;
  isBilledAgent: boolean;
}

export async function markActiveAgent(options: MarkActiveAgentOptions) {
  const { organizationId, agentId, isBilledAgent } = options;

  const lastActiveAt = new Date();
  await db
    .insert(activeAgents)
    .values({
      organizationId,
      agentId,
      lastActiveAt: new Date(),
      isBilledAgent,
    })
    .onConflictDoUpdate({
      target: activeAgents.agentId,
      set: {
        lastActiveAt,
        isBilledAgent,
      },
    });

  await setRedisData(
    'activeAgent',
    {
      agentId,
    },
    {
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      data: {
        lastActiveAt: lastActiveAt.getTime(),
        isBilledAgent,
      },
    },
  );
}

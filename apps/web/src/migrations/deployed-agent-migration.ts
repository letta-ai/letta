import { db, deployedAgents, users } from '@letta-cloud/database';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { AgentsService } from '@letta-cloud/letta-agents-api';

async function migrateByChunk(offset = 0, limit = 100) {
  console.log(`Migrating deployed agents from ${offset} to ${offset + limit}`);
  const allDeployedAgents = await db.query.deployedAgents.findMany({
    where: and(
      isNull(deployedAgents.migratedAt),
      isNotNull(deployedAgents.projectId),
    ),
    offset,
    limit,
    with: {
      organization: true,
    },
  });

  if (allDeployedAgents.length === 0) {
    return;
  }

  for (const deployedAgent of allDeployedAgents) {
    const activeOrganization = await db.query.users.findFirst({
      where: eq(users.activeOrganizationId, deployedAgent.organizationId),
    });

    if (!activeOrganization) {
      continue;
    }

    try {
      await AgentsService.modifyAgent(
        {
          agentId: deployedAgent.id,
          requestBody: {
            name: deployedAgent.key,
            project_id: deployedAgent.projectId,
            template_id: deployedAgent.deployedAgentTemplateId,
            base_template_id: deployedAgent.rootAgentTemplateId,
          },
        },
        {
          user_id: activeOrganization.lettaAgentsId,
        },
      );

      await db
        .update(deployedAgents)
        .set({
          migratedAt: new Date(),
        })
        .where(eq(deployedAgents.id, deployedAgent.id));
    } catch (_e) {
      console.error(
        `Agent is not migrated: ${deployedAgent.id} - ${deployedAgent.key}`,
      );
    }
  }

  await migrateByChunk(offset + limit, limit);
}

export async function deployedAgentMigration() {
  await migrateByChunk();
}

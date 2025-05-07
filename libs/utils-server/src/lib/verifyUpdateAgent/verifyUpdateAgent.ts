import { AgentsService } from '@letta-cloud/sdk-core';
import { agentTemplates, db } from '@letta-cloud/service-database';
import { and, eq, isNull } from 'drizzle-orm';

interface VerifyUpdateAgentProps {
  agentId: string;
  coreUserId: string;
  organizationId: string;
  name?: string;
}

export async function verifyUpdateAgent(options: VerifyUpdateAgentProps) {
  const { agentId, coreUserId, organizationId, name } = options;

  const [deployedAgent, agentTemplate] = await Promise.all([
    AgentsService.retrieveAgent(
      {
        agentId,
      },
      {
        user_id: coreUserId,
      },
    ),
    db.query.agentTemplates.findFirst({
      where: and(
        eq(agentTemplates.organizationId, organizationId),
        eq(agentTemplates.id, agentId),
        isNull(agentTemplates.deletedAt),
      ),
    }),
  ]);

  if (!(deployedAgent || agentTemplate)) {
    return {
      status: 404,
      body: {
        message: 'Agent not found',
      },
    };
  }

  if (agentTemplate) {
    if (name) {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return {
          status: 400,
          message: 'Name must be alphanumeric, with underscores or dashes',
        };
      }

      if (name !== agentTemplate.name) {
        const exists = await db.query.agentTemplates.findFirst({
          where: and(
            eq(agentTemplates.organizationId, organizationId),
            eq(agentTemplates.projectId, agentTemplate.projectId),
            eq(agentTemplates.name, name),
            isNull(agentTemplates.deletedAt),
          ),
        });

        if (exists) {
          return {
            status: 409,
            message: 'An agent with the same name already exists',
          };
        }

        await db
          .update(agentTemplates)
          .set({ name })
          .where(eq(agentTemplates.id, agentId));
      }
    }
  }

  return null;
}

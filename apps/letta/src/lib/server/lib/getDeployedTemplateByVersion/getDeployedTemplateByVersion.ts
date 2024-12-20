import {
  agentTemplates,
  db,
  deployedAgentTemplates,
} from '@letta-web/database';
import { and, desc, eq, isNull } from 'drizzle-orm';

export async function getDeployedTemplateByVersion(
  versionString: string,
  organizationId: string
): Promise<ReturnType<typeof db.query.deployedAgentTemplates.findFirst>> {
  const split = versionString.split(':');
  const templateName = split[0];
  const version = split[1];

  if (!version) {
    return undefined;
  }

  const rootAgentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, organizationId),
      eq(agentTemplates.name, templateName),
      isNull(agentTemplates.deletedAt)
    ),
  });

  if (!rootAgentTemplate) {
    return undefined;
  }

  if (version === 'latest') {
    return db.query.deployedAgentTemplates.findFirst({
      where: and(
        eq(deployedAgentTemplates.organizationId, organizationId),
        eq(deployedAgentTemplates.agentTemplateId, rootAgentTemplate.id),
        isNull(deployedAgentTemplates.deletedAt)
      ),
      orderBy: [desc(deployedAgentTemplates.createdAt)],
    });
  }

  return db.query.deployedAgentTemplates.findFirst({
    where: and(
      eq(deployedAgentTemplates.organizationId, organizationId),
      eq(deployedAgentTemplates.agentTemplateId, rootAgentTemplate.id),
      eq(deployedAgentTemplates.version, version),
      isNull(deployedAgentTemplates.deletedAt)
    ),
  });
}

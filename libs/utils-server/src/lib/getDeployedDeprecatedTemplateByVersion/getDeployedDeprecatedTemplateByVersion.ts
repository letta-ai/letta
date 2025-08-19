import {
  agentTemplates,
  db,
  deployedAgentTemplates,
} from '@letta-cloud/service-database';
import { and, desc, eq, isNull } from 'drizzle-orm';

export async function getDeployedDeprecatedTemplateByVersion(
  versionString: string,
  organizationId: string,
  projectId?: string,
): Promise<ReturnType<typeof db.query.deployedAgentTemplates.findFirst>> {
  const split = versionString.split(/:|%3A/);
  const templateName = split[0];
  const version = split[1];

  if (!version) {
    return undefined;
  }

  const rootAgentTemplate = await db.query.agentTemplates.findFirst({
    where: and(
      eq(agentTemplates.organizationId, organizationId),
      eq(agentTemplates.name, templateName),
      isNull(agentTemplates.deletedAt),
      ...(projectId ? [eq(agentTemplates.projectId, projectId)] : []),
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
        isNull(deployedAgentTemplates.deletedAt),
      ),
      orderBy: [desc(deployedAgentTemplates.createdAt)],
    });
  }

  return db.query.deployedAgentTemplates.findFirst({
    where: and(
      eq(deployedAgentTemplates.organizationId, organizationId),
      eq(deployedAgentTemplates.agentTemplateId, rootAgentTemplate.id),
      eq(deployedAgentTemplates.version, version),
      isNull(deployedAgentTemplates.deletedAt),
    ),
  });
}

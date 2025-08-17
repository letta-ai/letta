// project-slug/template-name:version
import type { TxType } from '@letta-cloud/service-database';
import { db, lettaTemplates, projects } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import type { VersionStringWithProject } from '@letta-cloud/utils-shared';
import { convertV1AgentTemplateToV2Agent } from '../convertV1AgentTemplateToV2Agent/convertV1AgentTemplateToV2Agent';

interface GetTemplateByNameOptions {
  versionString: VersionStringWithProject;
  organizationId: string;
  lettaAgentsId: string;
  includeAgents?: boolean;
  includeBlocks?: boolean;
  tx?: TxType;
}

export async function getTemplateByName(options: GetTemplateByNameOptions) {
  const {
    versionString,
    lettaAgentsId,
    organizationId,
    includeAgents,
    includeBlocks,
    tx,
  } = options;

  const [projectSlug, templateNameWithVersion] = versionString.split('/');
  const [templateName, version] = templateNameWithVersion.split(':');

  async function executeWithTransaction(transaction: TxType) {
    if (!templateName || !version) {
      return null;
    }

    // first load the project
    const project = await transaction.query.projects.findFirst({
      where: and(
        eq(projects.slug, projectSlug),
        eq(projects.organizationId, organizationId),
      ),
      columns: {
        id: true,
      },
    });

    if (!project) {
      return null;
    }

    const baseWhere = [
      eq(lettaTemplates.organizationId, organizationId),
      eq(lettaTemplates.projectId, project.id),
      eq(lettaTemplates.name, templateName),
    ];



    if (version === 'current') {
      baseWhere.push(eq(lettaTemplates.version, 'current'));
    } else if (version === 'latest') {
      baseWhere.push(eq(lettaTemplates.latestDeployed, true));
    } else {
      baseWhere.push(eq(lettaTemplates.version, version));
    }

    const response = await transaction.query.lettaTemplates.findFirst({
      where: and(...baseWhere),
      with: {
        agentTemplates: includeAgents ? true : undefined,
        blockTemplates: includeBlocks ? true : undefined,
      },
    });

    if (!response) {
      return null;
    }

    if (response.type === 'classic') {
      await convertV1AgentTemplateToV2Agent({
        agentTemplateId: response.id,
        organizationId,
        lettaAgentsId,
        projectId: project.id,
        tx: transaction,
      });

      return transaction.query.lettaTemplates.findFirst({
        where: and(...baseWhere),
        with: {
          agentTemplates: includeAgents ? true : undefined,
          blockTemplates: includeBlocks ? true : undefined,
        },
      });
    }

    return response;
  }

  // If a transaction is provided, use it; otherwise create a new one
  if (tx) {
    return executeWithTransaction(tx);
  } else {
    return db.transaction(executeWithTransaction);
  }
}

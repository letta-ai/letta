import type { TxType } from '@letta-cloud/service-database';
import { db } from '@letta-cloud/service-database';
import { lettaTemplates } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { validateVersionString } from '@letta-cloud/utils-shared';
import { getTemplateByName } from '../getTemplateByName/getTemplateByName';
import { copyTemplateEntities } from '../copyTemplate/copyTemplateEntities';



interface SaveTemplateOptions {
  projectSlug: string;
  templateName: string;
  organizationId: string;
  lettaAgentsId: string;
  message: string;
  tx?: TxType,
}

export async function saveTemplate(options: SaveTemplateOptions) {
  const { projectSlug, templateName, message, organizationId, lettaAgentsId, tx } =
    options;

  // check if templateName has version, remove it if it does
  const [nameWithoutVersion] = templateName.split(':');

  const versionString = `${projectSlug}/${nameWithoutVersion}:current`;

  if (!validateVersionString(versionString)) {
    throw new Error('Invalid version string format');
  }

  // first get the current template
  const template = await getTemplateByName({
    versionString,
    organizationId,
    lettaAgentsId,
    tx,
  });


  async function executeWithTransaction(transaction: TxType) {

    if (!template) {
      throw new Error(
        `Template ${templateName} not found in project ${projectSlug}`,
      );
    }

    const lettaTemplateId = template.id;

    // Get the latest deployed template by name and project
    const latestDeployedTemplate = await transaction.query.lettaTemplates.findFirst({
      where: and(
        eq(lettaTemplates.organizationId, organizationId),
        eq(lettaTemplates.projectId, template.projectId),
        eq(lettaTemplates.name, template.name),
        eq(lettaTemplates.latestDeployed, true),
      ),
      columns: {
        version: true,
        id: true,
      },
    });

    let latestDeployedTemplateVersion = '1';

    if (latestDeployedTemplate) {
      const vers = parseInt(latestDeployedTemplate.version, 10);

      if (isNaN(vers)) {
        throw new Error(`Invalid version number for template ${templateName}`);
      }

      latestDeployedTemplateVersion = (vers + 1).toString();

      // set the latest deployed template to not deployed
      await transaction
        .update(lettaTemplates)
        .set({ latestDeployed: false })
        .where(
          and(
            eq(lettaTemplates.id, latestDeployedTemplate.id),
            eq(lettaTemplates.organizationId, organizationId),
          ),
        );
    }

    // Create a new template with version incremented or set to 'current'
    const newTemplate = await transaction
      .insert(lettaTemplates)
      .values({
        name: template.name,
        organizationId: template.organizationId,
        projectId: template.projectId,
        version: latestDeployedTemplateVersion,
        latestDeployed: true,
        description: template.description,
        type: template.type,
        message: message,
        groupConfiguration: template.groupConfiguration,
      })
      .returning();

    const newTemplateId = newTemplate[0].id;

    // Copy all template entities (agent templates, block templates, and relationships)
    await copyTemplateEntities({
      sourceTemplateId: lettaTemplateId,
      targetTemplateId: newTemplateId,
      tx: transaction,
    });

    return newTemplate[0];
  };

  // If a transaction is provided, use it; otherwise create a new one
  if (tx) {
    return executeWithTransaction(tx);
  } else {
    return db.transaction(executeWithTransaction);
  }
}

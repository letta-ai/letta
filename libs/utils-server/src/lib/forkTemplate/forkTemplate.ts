import { db, lettaTemplates } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';
import { findUniqueAgentTemplateName } from '../findUniqueAgentTemplateName/findUniqueAgentTemplateName';
import { copyTemplateEntities } from '../copyTemplate/copyTemplateEntities';
import { saveTemplate } from '../saveTemplateVersion/saveTemplate';

interface ForkTemplateOptions {
  sourceTemplateId: string;
  organizationId: string;
  lettaAgentsId: string;
  name?: string;
  projectSlug: string;
}

export async function forkTemplate(options: ForkTemplateOptions) {
  const { sourceTemplateId, lettaAgentsId, projectSlug, organizationId, name } =
    options;

  return await db.transaction(async (tx) => {
    // 1. Validate source template exists and belongs to organization
    const sourceTemplate = await tx.query.lettaTemplates.findFirst({
      where: and(
        eq(lettaTemplates.id, sourceTemplateId),
        eq(lettaTemplates.organizationId, organizationId),
      ),
    });

    if (!sourceTemplate) {
      throw new Error(`Source template ${sourceTemplateId} not found`);
    }

    // 2. Validate custom name if provided
    if (name) {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw new Error(
          'Name must be alphanumeric with underscores and dashes only',
        );
      }

      const exists = await tx.query.lettaTemplates.findFirst({
        where: and(
          eq(lettaTemplates.organizationId, organizationId),
          eq(lettaTemplates.projectId, sourceTemplate.projectId),
          eq(lettaTemplates.name, name),
        ),
      });

      if (exists) {
        throw new Error('Name already exists');
      }
    }

    // 3. Generate unique name for the forked template (if not provided)
    const uniqueName = name || (await findUniqueAgentTemplateName());

    // 4. Create new template record with 'current' version
    const [newTemplate] = await tx
      .insert(lettaTemplates)
      .values({
        name: uniqueName,
        organizationId: sourceTemplate.organizationId,
        projectId: sourceTemplate.projectId,
        version: 'current',
        latestDeployed: false,
        description: sourceTemplate.description,
        type: sourceTemplate.type,
        message: `Forked from ${sourceTemplate.name}`,
        groupConfiguration: sourceTemplate.groupConfiguration,
      })
      .returning();

    // 5. Copy all template entities using the extracted function
    await copyTemplateEntities({
      sourceTemplateId: sourceTemplateId,
      targetTemplateId: newTemplate.id,
      tx,
    });

    await saveTemplate({
      organizationId,
      lettaAgentsId,
      projectSlug: projectSlug,
      templateName: uniqueName,
      message: 'Init',
      tx,
    });

    return newTemplate;
  });
}

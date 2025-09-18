import { db, lettaTemplates } from '@letta-cloud/service-database';
import { eq, and } from 'drizzle-orm';

export async function getCurrentTemplateActivity(options: { baseTemplateId: string }) {
  const { baseTemplateId } = options;

  try {
    const currentTemplate = await db.query.lettaTemplates.findFirst({
      where: and(
        eq(lettaTemplates.id, baseTemplateId),
        eq(lettaTemplates.version, 'current'),
      ),
    });

    if (!currentTemplate) {
      throw new Error(
        `Current template not found for baseTemplateId: ${baseTemplateId}`,
      );
    }

    return currentTemplate;
  } catch (error) {
    console.error('Failed to get current template:', error);
    throw new Error(
      error instanceof Error
        ? `Failed to get template: ${error.message}`
        : 'Failed to get template with unknown error'
    );
  }
}
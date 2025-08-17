import { agentTemplateV2, db } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

export interface GetAgentTemplateIdFromTemplatePayload {
  templateId: string;
  organizationId: string;
}

export async function getAgentTemplateIdFromTemplate(
  payload: GetAgentTemplateIdFromTemplatePayload,
): Promise<string | null> {
  const { templateId, organizationId } = payload;

  try {
    console.log(
      `Getting agent template ID for template ${templateId} in organization ${organizationId}`,
    );

    const agentTemplate = await db.query.agentTemplateV2.findFirst({
      where: eq(agentTemplateV2.lettaTemplateId, templateId),
      columns: {
        id: true,
      },
    });

    if (!agentTemplate) {
      console.error(
        `Agent template not found for template ${templateId} in organization ${organizationId}`,
      );
      return null;
    }

    console.log(
      `Found agent template ID ${agentTemplate.id} for template ${templateId}`,
    );

    return agentTemplate.id;
  } catch (error) {
    console.error(
      `Failed to get agent template ID for template ${templateId}:`,
      error,
    );
    throw error;
  }
}

import { proxyActivities, isCancellation } from '@temporalio/workflow';
import type { activities } from '../../activities';
import type {
  MigrateSingleAgentPayload,
  UpdateAgentFromAgentTemplateIdPayload,
} from '../../types';

const {
  getTemplateByName,
  getAgentTemplateIdFromTemplate,
  updateAgentFromAgentTemplateIdActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 hour',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
  },
});

export async function migrateSingleAgentWorkflow(
  payload: MigrateSingleAgentPayload,
): Promise<boolean> {
  const {
    agentId,
    versionString,
    preserveToolVariables,
    preserveCoreMemories,
    organizationId,
    lettaAgentsId,
  } = payload;

  try {
    console.log(
      `Starting migration for single agent ${agentId} to version ${versionString}`,
    );

    // First, get the template info from the version string
    const template = await getTemplateByName({
      versionString,
      organizationId,
      lettaAgentsId,
    });

    if (!template) {
      console.error(`Could not find template for version ${versionString}`);
      return false;
    }

    if (template.type !== 'classic') {
      console.error(
        `Migration for template type ${template.type} is not implemented`,
      );
      return false;
    }

    // Get the agent template ID from the template
    const agentTemplateId = await getAgentTemplateIdFromTemplate({
      templateId: template.id,
      organizationId,
    });

    if (!agentTemplateId) {
      console.error(
        `Agent template for version ${versionString} not found for organization ${organizationId}`,
      );
      return false;
    }

    // Create payload for the updateAgentFromAgentTemplateId activity
    const updatePayload: UpdateAgentFromAgentTemplateIdPayload = {
      agentId,
      agentTemplateId,
      preserveToolVariables,
      preserveCoreMemories,
      organizationId,
      lettaAgentsId,
      templateId: template.id,
    };

    // Call the updateAgentFromAgentTemplateId activity directly
    const result = await updateAgentFromAgentTemplateIdActivity(updatePayload);

    if (result) {
      console.log(
        `Successfully migrated agent ${agentId} to template ${agentTemplateId}`,
      );
    } else {
      console.error(
        `Failed to migrate agent ${agentId} to template ${agentTemplateId}`,
      );
    }

    return result;
  } catch (error) {
    if (isCancellation(error)) {
      console.warn(
        `migrateSingleAgentWorkflow for agent ${agentId} was canceled:`,
        error,
      );
    }

    console.error(`Error migrating single agent ${agentId}:`, error);
    throw error;
  }
}

import { migrateDeploymentEntities } from '@letta-cloud/utils-server';
import type { MigrateDeploymentEntitiesPayload } from '../../types';

export async function migrateDeploymentEntitiesActivity(
  payload: MigrateDeploymentEntitiesPayload,
): Promise<{ success: boolean; message?: string }> {
  const {
    deploymentId,
    templateId,
    preserveToolVariables = false,
    preserveCoreMemories = false,
    organizationId,
    lettaAgentsId,
    baseTemplateId,
    memoryVariables,
  } = payload;

  try {
    await migrateDeploymentEntities({
      deploymentId,
      templateId,
      preserveToolVariables,
      preserveCoreMemories,
      organizationId,
      lettaAgentsUserId: lettaAgentsId,
      baseTemplateId,
      memoryVariables: memoryVariables || {},
    });

    return {
      success: true,
      message: 'Deployment migration completed successfully',
    };
  } catch (error) {
    console.error('Deployment migration failed:', error);
    throw new Error(
      error instanceof Error
        ? `Deployment migration failed: ${error.message}`
        : 'Deployment migration failed with unknown error'
    );
  }
}

import { proxyActivities, isCancellation } from '@temporalio/workflow';
import type { activities } from '../../activities';
import type { MigrateDeploymentEntitiesPayload } from '../../types';

const { migrateDeploymentEntitiesActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '30 minutes', // Longer timeout for deployment migration
  retry: {
    maximumAttempts: 3,
    initialInterval: '5 seconds',
    maximumInterval: '60 seconds',
    backoffCoefficient: 2,
  },
});

export async function migrateDeploymentEntitiesWorkflow(
  payload: MigrateDeploymentEntitiesPayload,
): Promise<{ success: boolean; message?: string }> {
  const { deploymentId, templateId } = payload;

  try {
    console.log(
      `Starting deployment migration: deployment ${deploymentId} to template ${templateId}`,
    );

    // Execute the migration activity
    const result = await migrateDeploymentEntitiesActivity(payload);

    console.log(
      `Deployment migration completed successfully: deployment ${deploymentId} to template ${templateId}`,
    );

    return result;
  } catch (error) {
    if (isCancellation(error)) {
      console.warn('migrateDeploymentEntitiesWorkflow was canceled:', error);
    } else {
      console.error(
        `Deployment migration failed for deployment ${deploymentId}:`,
        error,
      );
    }
    throw error;
  }
}

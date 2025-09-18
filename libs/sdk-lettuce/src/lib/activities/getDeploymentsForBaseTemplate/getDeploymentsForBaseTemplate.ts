import { getDeploymentsForBaseTemplate } from '@letta-cloud/utils-server';

export async function getDeploymentsForBaseTemplateActivity(options: {
  baseTemplateId: string;
  organizationId: string;
  batchSize?: number;
  offset?: number;
}) {
  try {
    return await getDeploymentsForBaseTemplate(options);
  } catch (error) {
    console.error('Failed to get deployments for base template:', error);
    throw new Error(
      error instanceof Error
        ? `Failed to get deployments: ${error.message}`
        : 'Failed to get deployments with unknown error'
    );
  }
}
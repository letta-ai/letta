import { getTemplateByName as getTemplateByNameUtil } from '@letta-cloud/utils-server';
import type { VersionStringWithProject } from '@letta-cloud/utils-shared';

export interface GetTemplateByNamePayload {
  versionString: VersionStringWithProject;
  organizationId: string;
  lettaAgentsId: string;
  includeAgents?: boolean;
  includeBlocks?: boolean;
}

export async function getTemplateByName(payload: GetTemplateByNamePayload) {
  const {
    versionString,
    organizationId,
    lettaAgentsId,
    includeAgents,
    includeBlocks,
  } = payload;

  try {
    console.log(
      `Getting template by name for version ${versionString} in organization ${organizationId}`,
    );

    const template = await getTemplateByNameUtil({
      versionString,
      organizationId,
      lettaAgentsId,
      includeAgents,
      includeBlocks,
    });

    if (!template) {
      console.error(
        `Template ${versionString} not found for organization ${organizationId}`,
      );
      return null;
    }

    console.log(
      `Found template ${template.name} (${template.id}) for version ${versionString}`,
    );

    return template;
  } catch (error) {
    console.error(
      `Failed to get template by name for version ${versionString}:`,
      error,
    );
    throw error;
  }
}

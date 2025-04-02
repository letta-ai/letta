import {
  db,
  organizationPreferences,
  projects,
} from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

interface GetDefaultProjectArgs {
  organizationId: string;
}

export async function getDefaultProject(args: GetDefaultProjectArgs) {
  const { organizationId } = args;

  const orgPreferences = await db.query.organizationPreferences.findFirst({
    where: eq(organizationPreferences.organizationId, organizationId),
  });

  if (!orgPreferences?.defaultProjectId) {
    throw new Error('Organization preferences not found');
  }

  const createdProject = await db.query.projects.findFirst({
    where: eq(projects.id, orgPreferences.defaultProjectId),
  });

  if (!createdProject) {
    throw new Error('Project not found');
  }

  return createdProject.slug;
}

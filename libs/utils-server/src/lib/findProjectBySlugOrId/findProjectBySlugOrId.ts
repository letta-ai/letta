import { db, projects } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

interface FindProjectBySlugOrIdOptions {
  projectId?: string;
  projectSlug?: string;
}

export function findProjectBySlugOrId(options: FindProjectBySlugOrIdOptions) {
  const { projectId, projectSlug } = options;

  if (!projectId && !projectSlug) {
    return null;
  }

  if (projectId && projectSlug) {
    return null;
  }

  if (projectId) {
    return db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
  }

  if (projectSlug) {
    return db.query.projects.findFirst({
      where: eq(projects.slug, projectSlug),
    });
  }

  return null;
}

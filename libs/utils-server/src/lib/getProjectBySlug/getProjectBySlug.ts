import { db, projects } from '@letta-cloud/service-database';
import { and, eq } from 'drizzle-orm';

export function getProjectBySlug(slug: string, orgId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), eq(projects.organizationId, orgId)),
  });
}

import { getUserOrRedirect } from '$web/server/auth';
import { redirect } from 'next/navigation';
import { db, projects } from '@letta-cloud/service-database';
import { count, eq } from 'drizzle-orm';

async function HomePage() {
  const user = await getUserOrRedirect();

  if (!user?.activeOrganizationId) {
    redirect('/select-organization');
    return;
  }

  const projectCount = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.organizationId, user.activeOrganizationId));

  if (projectCount?.[0]?.count === 1) {
    redirect(`/projects/default-project`);
    return;
  }

  redirect(`/projects`);

  return;
}

export default HomePage;

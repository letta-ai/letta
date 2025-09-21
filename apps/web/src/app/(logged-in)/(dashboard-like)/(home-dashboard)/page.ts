import { getUserOrRedirect } from '$web/server/auth';
import { redirect } from 'next/navigation';
import { db, projects } from '@letta-cloud/service-database';
import { count, eq } from 'drizzle-orm';
import { getCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { getDefaultProject } from '@letta-cloud/utils-server';

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

  const totalProjects = projectCount?.[0]?.count ?? 0;

  // If there's only one project, go directly to it
  if (totalProjects === 1) {
    try {
      const defaultProject = await getDefaultProject({
        organizationId: user.activeOrganizationId,
      });
      redirect(`/projects/${defaultProject.slug}`);
    } catch (_e) {
      // Fallback if we can't get the default project
      redirect(`/projects/default-project`);
    }
    return;
  }

  // Multiple projects - check for last visited
  const cookieData = await getCookie(CookieNames.LAST_VISITED_PROJECT);

  if (cookieData) {
    const lastVisited = cookieData[user.activeOrganizationId];

    if (lastVisited?.slug) {
      redirect(`/projects/${lastVisited.slug}`);
      return;
    }
  }

  // Fallback to default project
  try {
    const defaultProject = await getDefaultProject({
      organizationId: user.activeOrganizationId,
    });
    redirect(`/projects/${defaultProject.slug}`);
  } catch (_e) {
    // If getDefaultProject fails, use the fallback slug
    redirect(`/projects/default-project`);
  }

  return;
}

export default HomePage;

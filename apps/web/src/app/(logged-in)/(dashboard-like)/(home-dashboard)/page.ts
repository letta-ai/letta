import { getUserOrRedirect } from '$web/server/auth';
import { redirect } from 'next/navigation';
import { getCookie } from '$web/server/cookies';
import { CookieNames } from '$web/server/cookies/types';
import { getDefaultProject } from '@letta-cloud/utils-server';

async function HomePage() {
  const user = await getUserOrRedirect();

  if (!user?.activeOrganizationId) {
    redirect('/select-organization');
    return;
  }

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

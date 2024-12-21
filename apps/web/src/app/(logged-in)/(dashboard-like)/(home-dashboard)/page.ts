import { getUserOrRedirect } from '$web/server/auth';
import { redirect } from 'next/navigation';

async function HomePage() {
  const user = await getUserOrRedirect();

  if (user?.hasCloudAccess) {
    redirect(`/projects`);

    return;
  }

  redirect(`/development-servers`);
}

export default HomePage;

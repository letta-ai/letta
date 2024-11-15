import { getUserOrRedirect } from '$letta/server/auth';
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

import { getUserOrRedirect } from '$letta/server/auth';
import { redirect } from 'next/navigation';

async function HomePage() {
  await getUserOrRedirect();

  redirect(`/projects`);
}

export default HomePage;

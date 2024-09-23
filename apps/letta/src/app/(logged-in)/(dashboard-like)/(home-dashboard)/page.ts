import { getUser } from '$letta/server/auth';
import { redirect } from 'next/navigation';

async function HomePage() {
  const user = await getUser();

  if (!user) {
    return redirect('/signout');
  }

  redirect(`/projects`);
}

export default HomePage;

import { db, projects } from '@letta-web/database';
import { eq } from 'drizzle-orm';
import { getUser } from '$letta/server/auth';
import { redirect } from 'next/navigation';

async function HomePage() {
  const user = await getUser();

  if (!user) {
    return redirect('/signout');
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.organizationId, user.organizationId),
  });

  if (!project) {
    return redirect('/projects');
  }

  redirect(`/projects`);
}

export default HomePage;

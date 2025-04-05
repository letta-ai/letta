'use server';
import { getDefaultProject } from '@letta-cloud/utils-server';
import { getUserOrRedirect } from '$web/server/auth';
import { redirect } from 'next/navigation';
import { agentTemplates, db } from '@letta-cloud/service-database';
import { eq } from 'drizzle-orm';

export default async function DefaultProjectRedirect() {
  const user = await getUserOrRedirect();

  if (!user?.activeOrganizationId) {
    redirect('/select-organization');
    return;
  }

  const { id: defaultProject, slug } = await getDefaultProject({
    organizationId: user.activeOrganizationId,
  });

  if (!defaultProject) {
    redirect('/projects');
    return;
  }

  const template = await db.query.agentTemplates.findFirst({
    where: eq(agentTemplates.projectId, defaultProject),
  });

  if (!template) {
    redirect(`/projects/${defaultProject}`);
    return;
  }

  redirect(`/projects/${slug}/templates/${template.name}`);

  return null;
}

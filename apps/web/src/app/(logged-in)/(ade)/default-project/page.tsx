'use server';
import { getDefaultProject } from '@letta-cloud/utils-server';
import { getUserOrRedirect } from '$web/server/auth';
import { redirect } from 'next/navigation';

export default async function DefaultProjectRedirect() {
  const user = await getUserOrRedirect();

  if (!user?.activeOrganizationId) {
    redirect('/select-organization');
    return;
  }

  const { slug: defaultProject } = await getDefaultProject({
    organizationId: user.activeOrganizationId,
  });

  redirect(`/projects/${defaultProject}`);

  return null;
}

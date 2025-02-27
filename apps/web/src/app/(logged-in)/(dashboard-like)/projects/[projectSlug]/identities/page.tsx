'use client';

import { IdentitiesTable } from '@letta-cloud/shared-ade-components';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';

export default function IdentitiesPage() {
  const { id } = useCurrentProject();
  return <IdentitiesTable currentProjectId={id} />;
}

'use client';

import { IdentitiesTable } from '@letta-cloud/shared-ade-components';
import { useCurrentProject } from '../hooks';

export default function IdentitiesPage() {
  const { id } = useCurrentProject();
  return <IdentitiesTable currentProjectId={id} />;
}

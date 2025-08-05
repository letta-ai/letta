'use client';

import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { VStack } from '@letta-cloud/ui-component-library';
import { ABTestsTable } from './_components/ABTestsTable/ABTestsTable';

export default function ABTestsPage() {
  const currentProject = useCurrentProject();
  const { id: projectId, slug: projectSlug } = currentProject;

  return (
    <VStack padding="xsmall" fullWidth fullHeight>
      <ABTestsTable projectId={projectId} projectSlug={projectSlug} />
    </VStack>
  );
}

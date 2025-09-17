'use client'
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { DashboardPageLayout, DashboardPageSection } from '@letta-cloud/ui-component-library';
import React from 'react';
import { ListRuns } from '@letta-cloud/ui-ade-components';

export default function RunsPage() {
  const t = useTranslations('dashboard/runs');
  const { id: projectId } = useCurrentProject();

  return (
    <DashboardPageLayout title={t('title')} encapsulatedFullHeight>
      <DashboardPageSection fullHeight>
        <ListRuns projectId={projectId} />
      </DashboardPageSection>
    </DashboardPageLayout>
  );

}

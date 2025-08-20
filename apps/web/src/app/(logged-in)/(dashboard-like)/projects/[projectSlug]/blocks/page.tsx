'use client';
import React from 'react';
import {
  DashboardPageLayout,
  DashboardPageSection,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  SearchMemoryBlocks,
} from '@letta-cloud/ui-ade-components';

export default function BlocksPage() {
  const t = useTranslations('dashboard/blocks');
  const { id: projectId } = useCurrentProject();

  return (
    <DashboardPageLayout title={t('title')} encapsulatedFullHeight>
      <DashboardPageSection fullHeight>
          <SearchMemoryBlocks projectId={projectId} />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

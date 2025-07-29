'use client';
import React from 'react';
import {
  DashboardPageLayout,
  DashboardPageSection,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  AppContextProvider,
  SearchMemoryBlocks,
} from '@letta-cloud/ui-ade-components';
import { useCurrentUser } from '$web/client/hooks';

export default function BlocksPage() {
  const t = useTranslations('dashboard/blocks');
  const { id: projectId, slug: projectSlug } = useCurrentProject();
  const user = useCurrentUser();

  return (
    <DashboardPageLayout title={t('title')} encapsulatedFullHeight>
      <DashboardPageSection fullHeight>
        <AppContextProvider
          projectSlug={projectSlug}
          user={user}
          projectId={projectId}
        >
          <SearchMemoryBlocks projectId={projectId} />
        </AppContextProvider>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  DashboardPageLayout,
} from '@letta-cloud/ui-component-library';

import React from 'react';
import { LettaManagedModels } from '../../../models/_components/LettaManagedModels/LettaManagedModels';

export default function ModelsPage() {
  const t = useTranslations('pages/models');

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      <LettaManagedModels />
    </DashboardPageLayout>
  );
}

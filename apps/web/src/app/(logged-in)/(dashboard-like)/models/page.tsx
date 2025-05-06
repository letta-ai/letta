'use client';
import { useTranslations } from '@letta-cloud/translations';
import { DashboardPageLayout } from '@letta-cloud/ui-component-library';
import React from 'react';
import { LettaManagedModels } from './_components/LettaManagedModels/LettaManagedModels';
import { BYOKModels } from './_components/BYOKModels/BYOKModels';

export default function ModelsPage() {
  const t = useTranslations('pages/models');

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      <BYOKModels />
      <LettaManagedModels />
    </DashboardPageLayout>
  );
}

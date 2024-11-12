import { useTranslations } from 'next-intl';
import {
  Alert,
  DashboardPageLayout,
  DashboardPageSection,
} from '@letta-web/component-library';
import React from 'react';

function Members() {
  const t = useTranslations('organization/billing');

  return (
    <DashboardPageLayout title={t('title')}>
      <DashboardPageSection>
        <Alert title={t('description')} variant="info" />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default Members;

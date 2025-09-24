'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  DashboardPageLayout,
  DashboardPageSection,
} from '@letta-cloud/ui-component-library';

function IntegrationsSettingsPage() {
  const t = useTranslations('organization/integrations');

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      <DashboardPageSection></DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default IntegrationsSettingsPage;

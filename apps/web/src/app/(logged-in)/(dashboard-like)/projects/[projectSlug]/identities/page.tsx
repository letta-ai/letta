'use client';

import { useTranslations } from '@letta-cloud/translations';
import { DashboardPageLayout } from '@letta-cloud/component-library';
import { IdentitiesTable } from '@letta-cloud/shared-ade-components';

export default function IdentitiesPage() {
  const t = useTranslations('project/[projectId]/identities');

  return (
    <DashboardPageLayout encapsulatedFullHeight title={t('title')}>
      <IdentitiesTable />
    </DashboardPageLayout>
  );
}

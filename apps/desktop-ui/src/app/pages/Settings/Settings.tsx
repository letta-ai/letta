import { useTranslations } from '@letta-cloud/translations';
import { DesktopPageLayout } from '../shared/DesktopPageLayout/DesktopPageLayout';
import { Alert, Typography, VStack } from '@letta-web/component-library';

export function Settings() {
  const t = useTranslations('Settings');

  return (
    <DesktopPageLayout title={t('title')}>
      <Alert title={t('description')} variant="warning" />
    </DesktopPageLayout>
  );
}

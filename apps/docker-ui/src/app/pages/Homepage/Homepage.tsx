import { CenterPage } from '../shared/CenterPage/CenterPage';
import {
  LettaLoader,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export function Homepage() {
  const t = useTranslations('Homepage');

  return (
    <CenterPage>
      <LettaLoader size="large" />
      <Typography color="muted">{t('booting')}</Typography>
    </CenterPage>
  );
}

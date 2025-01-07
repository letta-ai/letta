import { CenterPage } from '../shared/CenterPage/CenterPage';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  HStack,
  Logo,
  Typography,
  VStack,
} from '@letta-cloud/component-library';

export function InstallLetta() {
  const t = useTranslations('InstallLetta');

  function handleInstallLetta() {
    if (Object.prototype.hasOwnProperty.call(window, 'electron')) {
      window.electron.installLetta();
    }
  }

  return (
    <CenterPage>
      <VStack
        paddingTop="xxlarge"
        padding="xxlarge"
        align="center"
        justify="center"
      >
        <VStack fullHeight align="center">
          <VStack paddingY>
            <Logo size="large" />
          </VStack>
          <Typography variant="heading1">{t('title')}</Typography>
          <Typography variant="body2">{t('description')}</Typography>
        </VStack>
        <VStack paddingTop align="center">
          <HStack>
            <Button
              onClick={handleInstallLetta}
              label={t('install')}
              color="secondary"
            />
          </HStack>
          <HStack paddingX>
            <Typography color="muted" className="text-xxs">
              {t('below')}
            </Typography>
          </HStack>
        </VStack>
      </VStack>
    </CenterPage>
  );
}

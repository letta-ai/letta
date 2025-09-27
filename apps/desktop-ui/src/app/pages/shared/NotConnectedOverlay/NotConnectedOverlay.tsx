import { useServerStatus } from '../../../hooks/useServerStatus/useServerStatus';
import {
  Button,
  LettaLoader,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { Link } from 'react-router-dom';
import { useDesktopConfig } from '@letta-cloud/utils-client';

interface NotConnectedOverlayProps {
  children: React.ReactNode;
}

export function NotConnectedOverlay({ children }: NotConnectedOverlayProps) {
  const isConnected = useServerStatus();
  const t = useTranslations('NotConnectedOverlay');
  const { desktopConfig } = useDesktopConfig();

  const isSelfHosted = desktopConfig?.databaseConfig.type === 'local';
  const serverUrl =
    isSelfHosted && desktopConfig?.databaseConfig.type === 'local'
      ? desktopConfig.databaseConfig.url
      : null;

  return (
    <>
      {!isConnected && (
        <>
          <div className="absolute z-[8] bg-gray-100 w-[100dvw] h-[100dvh] opacity-60"></div>
          <div className="absolute z-[9] w-[100dvw] h-[100dvh] flex items-center justify-center">
            <div className="border max-w-[350px] w-full flex items-center justify-center py-8 bg-background">
              <VStack className="max-w-[300px]" align="center" padding>
                <LettaLoader size="xlarge" />
                <Typography bold>
                  {isSelfHosted ? t('connectingSelfHosted') : t('connecting')}
                </Typography>
                <Typography>
                  {isSelfHosted
                    ? t('detailsSelfHosted', {
                        serverUrl: serverUrl || 'your server',
                      })
                    : t('details')}
                </Typography>
                <VStack paddingTop>
                  <Link
                    to={
                      isSelfHosted
                        ? '/dashboard/settings'
                        : '/dashboard/server-status'
                    }
                  >
                    <Button
                      label={isSelfHosted ? t('actionSelfHosted') : t('action')}
                      color="primary"
                    />
                  </Link>
                </VStack>
              </VStack>
            </div>
          </div>
        </>
      )}
      {children}
    </>
  );
}

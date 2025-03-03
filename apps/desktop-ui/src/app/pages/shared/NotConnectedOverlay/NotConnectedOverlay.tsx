import { useServerStatus } from '../../../hooks/useServerStatus/useServerStatus';
import {
  Button,
  LettaLoader,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { Link } from 'react-router-dom';

interface NotConnectedOverlayProps {
  children: React.ReactNode;
}

export function NotConnectedOverlay({ children }: NotConnectedOverlayProps) {
  const isConnected = useServerStatus();
  const t = useTranslations('NotConnectedOverlay');

  return (
    <>
      {!isConnected && (
        <>
          <div className="absolute z-[99] bg-gray-100 w-[100dvw] h-[100dvh] opacity-60"></div>
          <div className="absolute z-[100] w-[100dvw] h-[100dvh] flex items-center justify-center">
            <div className="border max-w-[350px] w-full flex items-center justify-center py-8 bg-background">
              <VStack className="max-w-[300px]" align="center" padding>
                <LettaLoader size="xlarge" />
                <Typography bold>{t('connecting')}</Typography>
                <Typography>{t('details')}</Typography>
                <VStack paddingTop>
                  <Link to="/dashboard/server-status">
                    <Button label={t('action')} color="primary" />
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

'use client';
import {
  ActionCard,
  Card,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  NiceGridDisplay,
  RobotIcon,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { Tutorials } from '$letta/client/components';
import { CreateLocalAgentDialog } from '../shared/CreateLocalAgentDialog/CreateLocalAgentDialog';
import React, { useEffect, useRef } from 'react';
import { getIsLocalServiceOnline } from '$letta/client/local-project-manager';
import { ConnectToLocalServerCommand } from '$letta/client/components/ConnectToLocalServerCommand/ConnectToLocalServerCommand';

function useIsLocalServiceOnline() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLocalServiceOnline, setIsOnline] = React.useState(false);
  const interval = useRef<ReturnType<typeof setTimeout>>();

  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) {
      return;
    }

    mounted.current = true;

    void getIsLocalServiceOnline()
      .then(setIsOnline)
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    interval.current = setInterval(async () => {
      void getIsLocalServiceOnline().then(setIsOnline);
    }, 3000);

    return () => {
      clearInterval(interval.current);
    };
  }, []);

  return { isLocalServiceOnline, isLoading };
}

function DevelopmentServersDashboardPage() {
  const t = useTranslations('development-servers/dashboard/page');
  const { isLocalServiceOnline, isLoading } = useIsLocalServiceOnline();

  return (
    <DashboardPageLayout title={t('title')}>
      <DashboardPageSection title={t('gettingStarted.title')}>
        {isLocalServiceOnline ? (
          <NiceGridDisplay>
            <CreateLocalAgentDialog
              trigger={
                <ActionCard
                  isSkeleton={isLoading}
                  icon={<RobotIcon />}
                  title={t('gettingStarted.actions.createAgent.title')}
                  description={t(
                    'gettingStarted.actions.createAgent.description'
                  )}
                />
              }
            />
          </NiceGridDisplay>
        ) : (
          <VStack width="contained">
            <Card>
              <Typography bold>{t('notConnected')}</Typography>
              <Typography>{t('start')}</Typography>
              <HStack paddingTop>
                <ConnectToLocalServerCommand />
              </HStack>
            </Card>
          </VStack>
        )}
      </DashboardPageSection>
      <Tutorials />
    </DashboardPageLayout>
  );
}

export default DevelopmentServersDashboardPage;

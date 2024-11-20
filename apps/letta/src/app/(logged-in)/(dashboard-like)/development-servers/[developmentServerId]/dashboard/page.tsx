'use client';
import {
  ActionCard,
  AdBanner,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  NiceGridDisplay,
  RobotIcon,
  SearchIcon,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { Tutorials } from '$letta/client/components';
import React, { useEffect, useRef } from 'react';
import { getIsLocalServiceOnline } from '$letta/client/local-project-manager';
import Link from 'next/link';
import bannerBlue from './banner_blue.png';
import bannerOrange from './banner_orange.png';
import { useCurrentUser } from '$letta/client/hooks';
import { useLocalStorageWithLoadingState } from '@letta-web/helpful-client-utils';
import { CLOUD_UPSELL_URL } from '$letta/constants';
import { UserIsNotConnectedComponent } from '../components/UserIsNotConnectedComponent/UserIsNotConnectedComponent';

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

function UpgradeBanner() {
  const [isDismissed, setIsDismissed, isLoading] =
    useLocalStorageWithLoadingState<boolean>(
      'development-servers/dashboard/page/upgrade-banner',
      false
    );

  const t = useTranslations('development-servers/dashboard/page');

  if (isDismissed || isLoading) {
    return null;
  }

  return (
    <AdBanner
      /* eslint-disable-next-line react/forbid-component-props */
      className="min-h-[350px] max-w-[1216px]"
      textContentClassName="largerThanMobile:w-[70%] largerThanMobile:w-[60%]"
      title={t('UpgradeBanner.title')}
      description={t('UpgradeBanner.description')}
      action={
        <HStack>
          <Button
            href={CLOUD_UPSELL_URL}
            target="_blank"
            color="secondary"
            label={t('UpgradeBanner.cta')}
            size="large"
          />
        </HStack>
      }
      onClose={{
        operation: () => {
          setIsDismissed(true);
        },
        text: t('UpgradeBanner.dismiss'),
      }}
      imageUrl={bannerBlue}
      darkModeImage={bannerOrange}
    />
  );
}

function DevelopmentServersDashboardPage() {
  const t = useTranslations('development-servers/dashboard/page');
  const { isLocalServiceOnline, isLoading } = useIsLocalServiceOnline();
  const user = useCurrentUser();

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      {!user?.hasCloudAccess && (
        <VStack paddingTop="medium">
          <UpgradeBanner />{' '}
        </VStack>
      )}

      <DashboardPageSection title={t('gettingStarted.title')}>
        {isLocalServiceOnline ? (
          <NiceGridDisplay>
            <Link href="/development-servers/local/agents/new">
              <ActionCard
                isSkeleton={isLoading}
                icon={<RobotIcon />}
                title={t('gettingStarted.actions.createAgent.title')}
                description={t(
                  'gettingStarted.actions.createAgent.description'
                )}
              />
            </Link>
            <Link href="/development-servers/local/agents">
              <ActionCard
                fullHeight
                icon={<SearchIcon />}
                onClick={() => {
                  // do nothing
                }}
                title={t('gettingStarted.actions.viewAgents.title')}
                description={t('gettingStarted.actions.viewAgents.description')}
              />
            </Link>
          </NiceGridDisplay>
        ) : (
          <VStack width="contained">
            <UserIsNotConnectedComponent />
          </VStack>
        )}
      </DashboardPageSection>
      <Tutorials />
    </DashboardPageLayout>
  );
}

export default DevelopmentServersDashboardPage;

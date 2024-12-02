'use client';
import {
  ActionCard,
  AdBanner,
  Alert,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  InlineCode,
  NiceGridDisplay,
  Robot2Icon,
  SearchIcon,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { Tutorials } from '$letta/client/components';
import React, { useMemo } from 'react';
import Link from 'next/link';
import bannerBlue from './banner_blue.png';
import bannerOrange from './banner_orange.png';
import { useCurrentUser } from '$letta/client/hooks';
import { useLocalStorageWithLoadingState } from '@letta-web/helpful-client-utils';
import {
  CLOUD_UPSELL_URL,
  MOST_RECENT_LETTA_AGENT_VERSION,
  SUPPORTED_LETTA_AGENTS_VERSIONS,
} from '$letta/constants';
import { UserIsNotConnectedComponent } from '../components/UserIsNotConnectedComponent/UserIsNotConnectedComponent';
import { useHealthServiceHealthCheck } from '@letta-web/letta-agents-api';

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
  const { data: isLocalServiceOnline, isLoading } = useHealthServiceHealthCheck(
    undefined,
    {
      refetchInterval: 3000,
    }
  );
  const user = useCurrentUser();

  const showVersionCompatibilityBanner = useMemo(() => {
    if (!isLocalServiceOnline) {
      return false;
    }

    return !SUPPORTED_LETTA_AGENTS_VERSIONS.includes(
      isLocalServiceOnline.version
    );
  }, [isLocalServiceOnline]);

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      {!user?.hasCloudAccess && (
        <VStack paddingTop="medium">
          <UpgradeBanner />{' '}
        </VStack>
      )}

      <DashboardPageSection title={t('gettingStarted.title')}>
        {showVersionCompatibilityBanner && (
          <Alert
            title={t('versionCompatibilityBanner.title', {
              version: MOST_RECENT_LETTA_AGENT_VERSION,
            })}
            variant="warning"
          >
            <VStack>
              {t('versionCompatibilityBanner.description')}
              <div>
                <InlineCode
                  code={`pip install letta==${MOST_RECENT_LETTA_AGENT_VERSION}`}
                />
              </div>
            </VStack>
          </Alert>
        )}
        {isLocalServiceOnline ? (
          <NiceGridDisplay>
            <Link href="/development-servers/local/agents/new">
              <ActionCard
                onClick={() => {
                  // do nothing (this makes the UI show a hover state)
                }}
                isSkeleton={isLoading}
                icon={<Robot2Icon />}
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
                  // do nothing (this makes the UI show a hover state)
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

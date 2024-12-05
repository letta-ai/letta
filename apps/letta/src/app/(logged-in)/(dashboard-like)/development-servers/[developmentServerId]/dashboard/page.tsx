'use client';
import {
  AdBanner,
  Alert,
  Button,
  CTACard,
  DashboardPageLayout,
  DashboardPageSection,
  Frame,
  HStack,
  InlineCode,
  LettaLoader,
  Logo,
  NiceGridDisplay,
  LettaInvaderOutlineIcon,
  SearchIcon,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import {
  ConnectToLocalServerCommand,
  Tutorials,
} from '$letta/client/components';
import React, { useMemo } from 'react';
import bannerBlue from './banner_blue.png';
import bannerOrange from './banner_orange.png';
import { useCurrentUser } from '$letta/client/hooks';
import { useLocalStorageWithLoadingState } from '@letta-web/helpful-client-utils';
import {
  CLOUD_UPSELL_URL,
  MOST_RECENT_LETTA_AGENT_VERSION,
  SUPPORTED_LETTA_AGENTS_VERSIONS,
} from '$letta/constants';
import { useHealthServiceHealthCheck } from '@letta-web/letta-agents-api';
import { useWelcomeText } from '$letta/client/hooks/useWelcomeText/useWelcomeText';
import { cn } from '@letta-web/core-style-config';

import AdBannerTwo from './ad_banner_two.webp';
import Image from 'next/image';

interface UserIsNotConnectedComponentProps {
  isAttemptingToConnect?: boolean;
}

function UserIsNotConnectedComponent(props: UserIsNotConnectedComponentProps) {
  const t = useTranslations(
    'development-servers/components/UserIsNotConnectedComponent'
  );

  const { isAttemptingToConnect } = props;

  return (
    <VStack
      paddingY="xxlarge"
      align="center"
      justify="center"
      border
      fullHeight
      fullWidth
    >
      <LettaLoader stopAnimation={!isAttemptingToConnect} size="large" />
      <VStack gap="small" paddingTop>
        <Typography variant="heading5">
          {!isAttemptingToConnect ? t('notConnected') : t('connecting')}
        </Typography>
        <VStack align="center">
          <Typography variant="heading6">{t('start')}</Typography>
          <HStack>
            <ConnectToLocalServerCommand />
          </HStack>
        </VStack>
      </VStack>
    </VStack>
  );
}

interface UpgradeBannerProps {
  isDismissed: boolean;
  setIsDismissed: (value: boolean) => void;
}

function UpgradeBanner(props: UpgradeBannerProps) {
  const { isDismissed, setIsDismissed } = props;

  const t = useTranslations('development-servers/dashboard/page');

  return (
    <AdBanner
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
          setIsDismissed(!isDismissed);
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
      retry: 1,
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

  const welcomeText = useWelcomeText();

  const title = useMemo(() => {
    if (user?.hasCloudAccess) {
      return t('title');
    }

    return welcomeText || t('title');
  }, [t, user?.hasCloudAccess, welcomeText]);

  const [isDismissed, setIsDismissed, isLoadingDismissed] =
    useLocalStorageWithLoadingState<boolean>(
      'development-servers/dashboard/page/upgrade-banner',
      false
    );

  return (
    <DashboardPageLayout cappedWidth title={title} subtitle={t('description')}>
      <VStack paddingX="large">
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
                  size="medium"
                  color="warning"
                  code={`pip install letta==${MOST_RECENT_LETTA_AGENT_VERSION}`}
                />
              </div>
            </VStack>
          </Alert>
        )}
      </VStack>
      {!user?.hasCloudAccess && (
        <VStack
          paddingX="large"
          /* eslint-disable-next-line react/forbid-component-props */
          className={cn(
            isDismissed || isLoadingDismissed ? 'h-0 pt-0' : 'h-[350px]',
            'overflow-hidden transition-all duration-300'
          )}
          overflow="hidden"
          paddingTop="medium"
        >
          <div className="h-full">
            <UpgradeBanner
              isDismissed={isDismissed}
              setIsDismissed={setIsDismissed}
            />
          </div>
        </VStack>
      )}

      <DashboardPageSection
        title={t('gettingStarted.title')}
        description={t('gettingStarted.description')}
      >
        {isLocalServiceOnline ? (
          <NiceGridDisplay itemWidth="252px" itemHeight="252px">
            <CTACard
              action={
                <Button
                  href="/development-servers/local/agents/new"
                  label={t('gettingStarted.actions.createAgent.cta')}
                  color="secondary"
                />
              }
              icon={<LettaInvaderOutlineIcon />}
              title={t('gettingStarted.actions.createAgent.title')}
              subtitle={t('gettingStarted.actions.createAgent.description')}
            />
            <CTACard
              action={
                <Button
                  href="/development-servers/local/agents"
                  label={t('gettingStarted.actions.viewAgents.cta')}
                  color="secondary"
                />
              }
              icon={<SearchIcon />}
              title={t('gettingStarted.actions.viewAgents.title')}
              subtitle={t('gettingStarted.actions.viewAgents.description')}
            />
            {isDismissed && !isLoadingDismissed && !user?.hasCloudAccess && (
              <VStack
                justify="spaceBetween"
                padding
                overflow="hidden"
                position="relative"
              >
                <button
                  onClick={() => {
                    setIsDismissed(false);
                  }}
                >
                  <Logo size="large" color="steel" />
                </button>
                <VStack>
                  <Typography color="white" variant="heading5">
                    {t('gettingStarted.actions.cloudSignup.title')}
                  </Typography>
                  <Typography color="white">
                    {t('gettingStarted.actions.cloudSignup.details')}
                  </Typography>
                </VStack>
                <Frame>
                  <Button
                    href={CLOUD_UPSELL_URL}
                    target="_blank"
                    color="secondary"
                    label={t('gettingStarted.actions.cloudSignup.cta')}
                  />
                </Frame>
                <Frame
                  color="primary"
                  position="absolute"
                  /* eslint-disable-next-line react/forbid-component-props */
                  className="top-0 right-0 z-[-1]"
                >
                  <Image src={AdBannerTwo} alt="" />
                </Frame>
              </VStack>
            )}
          </NiceGridDisplay>
        ) : (
          <NiceGridDisplay>
            <div className="col-span-4">
              <UserIsNotConnectedComponent isAttemptingToConnect={isLoading} />
            </div>
          </NiceGridDisplay>
        )}
      </DashboardPageSection>
      <Tutorials />
    </DashboardPageLayout>
  );
}

export default DevelopmentServersDashboardPage;

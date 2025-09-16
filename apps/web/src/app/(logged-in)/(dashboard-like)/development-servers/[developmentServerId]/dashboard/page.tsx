'use client';
import {
  Alert,
  Button,
  CTACard,
  DashboardPageLayout,
  DashboardPageSection,
  LettaLoader,
  NiceGridDisplay,
  LettaInvaderOutlineIcon,
  SearchIcon,
  Typography,
  VStack,
  PlusIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { Tutorials } from '$web/client/components';
import React, { useMemo } from 'react';
import { SUPPORTED_LETTA_AGENTS_VERSIONS } from '$web/constants';
import { useHealthServiceCheckHealth } from '@letta-cloud/sdk-core';

import semver from 'semver/preload';
import Link from 'next/link';
import CreateAgentDialog from '../components/CreateAgentDialog/CreateAgentDialog';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useParams } from 'next/navigation';

function UserIsNotConnectedComponent() {
  const t = useTranslations(
    'development-servers/components/UserIsNotConnectedComponent',
  );

  return (
    <VStack
      paddingY="xxlarge"
      align="center"
      justify="center"
      border
      fullHeight
      fullWidth
    >
      <LettaLoader variant="spinner3d" size="default"  />
      <VStack gap="small" paddingTop>
        <Typography align="center" fullWidth variant="heading5">
          {t('connecting')}
        </Typography>
        <Typography align="center" fullWidth variant="body">
          {t.rich('issuesConnecting', {
            link: (chunks) => (
              <Typography overrideEl="span" underline>
                <Link
                  target="_blank"
                  href="https://docs.letta.com/guides/selfhosting"
                >
                  {chunks}
                </Link>
              </Typography>
            ),
          })}
        </Typography>
      </VStack>
    </VStack>
  );
}

function DevelopmentServersDashboardPage() {
  const t = useTranslations('development-servers/dashboard/page');
  const { data: isLocalServiceOnline } = useHealthServiceCheckHealth(
    undefined,
    {
      retry: 1,
      refetchInterval: 3000,
    },
  );

  const showVersionCompatibilityBanner = useMemo(() => {
    if (!isLocalServiceOnline) {
      return false;
    }

    return !semver.satisfies(
      isLocalServiceOnline.version,
      SUPPORTED_LETTA_AGENTS_VERSIONS,
    );
  }, [isLocalServiceOnline]);

  const { developmentServerId } = useParams<{ developmentServerId: string }>();

  const { data: currentServer } =
    webApi.developmentServers.getDevelopmentServer.useQuery({
      queryData: {
        params: {
          developmentServerId,
        },
      },
      queryKey:
        webApiQueryKeys.developmentServers.getDevelopmentServer(
          developmentServerId,
        ),
    });

  return (
    <DashboardPageLayout
      headerBottomPadding="large"
      title={currentServer?.body.developmentServer.name || t('title')}
      subtitle={t('description')}
    >
      <VStack paddingX="large">
        {showVersionCompatibilityBanner && (
          <Alert
            title={t('versionCompatibilityBanner.title', {
              version: SUPPORTED_LETTA_AGENTS_VERSIONS,
            })}
            variant="warning"
          ></Alert>
        )}
      </VStack>

      <DashboardPageSection
        title={t('gettingStarted.title')}
        description={t('gettingStarted.description')}
      >
        {isLocalServiceOnline ? (
          <NiceGridDisplay itemWidth="252px" itemHeight="252px">
            <CTACard
              action={
                <CreateAgentDialog
                  trigger={
                    <Button
                      preIcon={<PlusIcon />}
                      color="primary"
                      label={t('gettingStarted.actions.createAgent.cta')}
                    />
                  }
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
                  color="primary"
                />
              }
              icon={<SearchIcon />}
              title={t('gettingStarted.actions.viewAgents.title')}
              subtitle={t('gettingStarted.actions.viewAgents.description')}
            />
          </NiceGridDisplay>
        ) : (
          <NiceGridDisplay>
            <div className="col-span-4">
              <UserIsNotConnectedComponent />
            </div>
          </NiceGridDisplay>
        )}
      </DashboardPageSection>
      <Tutorials />
    </DashboardPageLayout>
  );
}

export default DevelopmentServersDashboardPage;

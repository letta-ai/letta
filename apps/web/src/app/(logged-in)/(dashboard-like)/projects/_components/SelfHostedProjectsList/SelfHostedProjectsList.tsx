'use client';
import React from 'react';
import {
  Button,
  Card,
  HStack,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  Skeleton,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslations } from '@letta-cloud/translations';
import {
  type DevelopmentServerConfig,
} from '@letta-cloud/utils-client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { ConnectToSelfHostedProjectDialog } from '../ConnectToSelfHostedProjectDialog/ConnectToSelfHostedProjectDialog';
import { LOCAL_PROJECT_SERVER_URL } from '$web/constants';
import { SelfHostedStatusIndicator } from '$web/client/components/SelfHostedServerStatusIndicator/SelfHostedStatusIndicator';

interface SelfHostedProjectsListProps {
  search: string;
}

interface DevelopmentServerCardProps {
  config: DevelopmentServerConfig;
}

function DevelopmentServerCard(props: DevelopmentServerCardProps) {
  const { config } = props;
  const { url, name } = config;

  return (
    <Card
      href={`/development-servers/${config.id}/dashboard`}
      /* eslint-disable-next-line react/forbid-component-props */
      className="bg-project-card-background border border-background-grey3-border hover:bg-background-grey2 relative"
    >
      <VStack fullWidth>
        <VStack gap="medium" fullWidth>
          <VStack gap="text">
            <HStack align="center">
              <SelfHostedStatusIndicator config={config} />
              <Typography
                bold
                align="left"
                variant="body"
                noWrap
                fullWidth
                overflow="ellipsis"
              >
                {name}
              </Typography>
            </HStack>
            <Typography
              variant="body3"
              color="muted"
              noWrap
              fullWidth
              overflow="ellipsis"
            >
              {url}
            </Typography>
          </VStack>
        </VStack>
      </VStack>
    </Card>
  );
}

function CreateDevelopmentServerButton() {
  const t = useTranslations('projects/page/SelfHostedProjectsList');

  return (
    <ConnectToSelfHostedProjectDialog
      trigger={<Button label={t('createDevelopmentServerButton.label')} />}
    />
  );
}

export function SelfHostedProjectsList(props: SelfHostedProjectsListProps) {
  const { search } = props;
  const t = useTranslations('projects/page/SelfHostedProjectsList');
  const [debouncedSearch] = useDebouncedValue(search, 500);

  const { data, isError, isLoading } =
    webApi.developmentServers.getDevelopmentServers.useQuery({
      queryKey:
        webApiQueryKeys.developmentServers.getDevelopmentServersWithSearch({
          search: debouncedSearch,
        }),
      queryData: {
        query: {
          search: debouncedSearch,
          offset: 0,
          limit: 50,
        },
      },
    });

  // only show if searching or is error
  if (
    isError ||
    (search &&
      !isLoading &&
      (data?.body.developmentServers.length === 0 || !data))
  ) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
        isError={isError}
        emptyMessage={
          debouncedSearch
            ? t('developmentServersList.noSearchResults')
            : t('developmentServersList.noDevelopmentServers')
        }
        emptyAction={<CreateDevelopmentServerButton />}
        loadingMessage={t('developmentServersList.loading')}
      />
    );
  }

  return (
    <>
      <NiceGridDisplay>
        <DevelopmentServerCard
          key="local"
          config={{
            name: 'local',
            url: LOCAL_PROJECT_SERVER_URL,
            password: '',
            id: 'local',
          }}
        />
        {!data &&
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="w-full h-full" />
          ))}
        {data?.body?.developmentServers.map((developmentServer) => (
          <DevelopmentServerCard
            key={developmentServer.id}
            config={developmentServer}
          />
        ))}
      </NiceGridDisplay>
    </>
  );
}

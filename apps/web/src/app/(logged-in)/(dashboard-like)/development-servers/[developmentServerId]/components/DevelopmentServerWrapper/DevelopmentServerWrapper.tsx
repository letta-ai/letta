'use client';
import React from 'react';
import {
  LettaAgentsAPIWrapper,
} from '@letta-cloud/utils-client';
import { Button, LoadingEmptyStatusComponent } from '@letta-cloud/ui-component-library';
import { useParams } from 'next/navigation';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

interface DevelopmentServerWrapperProps {
  children: React.ReactNode;
}

export function DevelopmentServerWrapper(props: DevelopmentServerWrapperProps) {
  const { children } = props;
  const { developmentServerId } = useParams<{ developmentServerId: string }>();

  const t = useTranslations('development-servers/wrapper');

  const { error, data } =
    webApi.developmentServers.getDevelopmentServer.useQuery({
      queryKey:
        webApiQueryKeys.developmentServers.getDevelopmentServer(
          developmentServerId,
        ),
      queryData: {
        params: {
          developmentServerId,
        },
      },
      retry: false,
      enabled: !!developmentServerId,
    });


  if (!data) {
    return (
      <LoadingEmptyStatusComponent
        isError={!!error}
        errorMessage={t('error')}
        errorAction={(
          <Button
            href="/settings/organization/projects?view-mode=selfHosted"
            label={t('goToList')}
          />
        )}
        emptyMessage=""
        isLoading={!data && !error}
      />
    );
  }

  return (
    <LettaAgentsAPIWrapper
      baseUrl={data.body.developmentServer.url}
      password={data.body.developmentServer.password || ''}
    >
      {children}
    </LettaAgentsAPIWrapper>
  );
}

import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Button,
  LoadingEmptyStatusComponent,
  RocketIcon,
  Typography,
  VStack,
} from '@letta-cloud/component-library';
import React from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import type { webApiContracts } from '@letta-cloud/web-api-client';
import { useCurrentAgentMetaData } from '@letta-cloud/shared-ade-components';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';

function NotCreatedLinkView() {
  const t = useTranslations('pages/distribution/LaunchLinks');
  const queryClient = useQueryClient();
  const { agentId: agentTemplateId } = useCurrentAgentMetaData();

  const { mutate, isPending, isError } =
    webApi.launchLinks.createLaunchLink.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          ServerInferResponses<typeof webApiContracts.launchLinks.getLaunchLink>
        >(
          {
            queryKey:
              webApiQueryKeys.launchLinks.getLaunchLink(agentTemplateId),
          },
          () => ({
            status: 200,
            body: response.body,
          }),
        );
      },
    });

  if (isPending) {
    return (
      <VStack
        color="background-grey"
        fullHeight
        justify="center"
        fullWidth
        align="center"
      >
        <LoadingEmptyStatusComponent
          isLoading
          loadingMessage={t('NotCreatedLinkView.creating')}
        />
      </VStack>
    );
  }

  return (
    <VStack
      color="background-grey"
      fullHeight
      justify="center"
      fullWidth
      align="center"
    >
      {isError && (
        <Alert title={t('NotCreatedLinkView.error')} variant="destructive" />
      )}
      <RocketIcon size="xxlarge" />
      <Typography variant="heading5" bold>
        {t('NotCreatedLinkView.title')}
      </Typography>
      <div className="max-w-[600px]">
        <Typography>{t('NotCreatedLinkView.description')}</Typography>
      </div>
      <Button
        onClick={() => {
          mutate({
            params: {
              agentTemplateId,
            },
          });
        }}
        label={t('NotCreatedLinkView.cta')}
        color="primary"
      />
    </VStack>
  );
}

export function LaunchLinks() {
  const { agentId } = useCurrentAgentMetaData();
  const { data: launchLinkConfig } = webApi.launchLinks.getLaunchLink.useQuery({
    queryKey: webApiQueryKeys.launchLinks.getLaunchLink(agentId),
    queryData: {
      params: {
        agentTemplateId: agentId,
      },
    },
  });

  if (!launchLinkConfig) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  // @ts-expect-error -- status can be 404
  if (launchLinkConfig.status === 404) {
    return <NotCreatedLinkView />;
  }

  return (
    <VStack
      color="background-grey"
      fullHeight
      justify="center"
      fullWidth
      align="center"
    >
      Swagger
    </VStack>
  );
}

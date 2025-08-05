'use client';
import { useABTestId } from '../hooks/useABTestId/useABTestId';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  ChatInput,
  HStack,
  LoadingEmptyStatusComponent,
  PersonIcon,
  SystemIcon,
  VR,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { Fragment, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { TemplateChatSimulator } from './_components/TemplateChatSimulator/TemplateChatSimulator';
import { AttachTemplateToSimulator } from './_components/AttachTemplateToSimulator/AttachTemplateToSimulator';
import { useSendMessage } from '@letta-cloud/ui-ade-components';
import { isFetchError } from '@ts-rest/react-query/v5';

function ABTests() {
  const abTestId = useABTestId();

  const t = useTranslations('projects/ab-tests.ABTests');
  const { data, isError, error } = webApi.abTest.getAbTestTemplates.useQuery({
    queryKey: webApiQueryKeys.abTest.getAbTestTemplates(abTestId),
    queryData: {
      params: { abTestId },
    },
    retry: 3,
    enabled: !!abTestId,
  });

  const templates = useMemo(() => data?.body?.templates || [], [data]);

  const { sendMessage, isPending } = useSendMessage();

  const isNotFound = useMemo(() => {
    if (isFetchError(error)) {
      return false;
    }

    return error?.status === 404;
  }, [error]);

  if (isNotFound) {
    return (
      <VStack fullWidth fullHeight>
        <LoadingEmptyStatusComponent
          errorMessage={t('notFound')}
          isError
          isLoading={false}
        />
      </VStack>
    );
  }

  if (!data?.body || isError) {
    return (
      <VStack fullWidth fullHeight>
        <LoadingEmptyStatusComponent
          loadingMessage={t('loading')}
          errorMessage={isError ? t('loadingError') : undefined}
          isLoading
        />
      </VStack>
    );
  }

  const arraySize = Math.max(2, templates.length);

  return (
    <>
      <HStack
        overflowX="auto"
        gap={false}
        fullWidth
        collapseHeight
        flex
        overflow="hidden"
      >
        {new Array(arraySize).fill(null).map((_, index) => {
          const selectedTemplate = templates[index];

          return (
            <Fragment key={index}>
              <VStack gap={false} fullHeight fullWidth>
                {selectedTemplate ? (
                  <TemplateChatSimulator
                    key={selectedTemplate.id}
                    template={selectedTemplate}
                  />
                ) : (
                  <AttachTemplateToSimulator />
                )}
              </VStack>
              {index !== arraySize - 1 && <VR />}
            </Fragment>
          );
        })}
      </HStack>
      <HStack
        paddingTop="xlarge"
        fullWidth
        borderTop
        align="center"
        justify="center"
        padding
      >
        <div className="min-w-[320px] max-w-[600px] w-full">
          <ChatInput
            sendingMessageText={t('sendingMessage')}
            isSendingMessage={isPending}
            onSendMessage={(role, content) => {
              templates.forEach((template) => {
                sendMessage({
                  role,
                  content,
                  agentId: template.coreAgentId,
                });
              });
            }}
            roles={[
              {
                value: 'user',
                identityId: 'placeholderId',
                label: t('role.user'),
                icon: <PersonIcon />,
              },
              {
                value: 'system',
                label: t('role.system'),
                icon: <SystemIcon />,
              },
            ]}
          />
        </div>
      </HStack>
    </>
  );
}

export default function ABTestPage() {
  return (
    <VStack fullHeight fullWidth gap={false} overflow="hidden">
      <VStack collapseHeight gap={false} flex>
        <ABTests />
      </VStack>
    </VStack>
  );
}

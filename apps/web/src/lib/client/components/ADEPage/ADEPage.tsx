'use client';
import React from 'react';
import {
  Alert,
  HStack,
  LettaLoader,
  LoadingEmptyStatusComponent,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ADEHeader } from '$web/client/components/ADEPage/ADEHeader/ADEHeader';
import { ErrorBoundary } from 'react-error-boundary';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useAtomValue } from 'jotai/index';
import { TemplateNavigationSidebar } from './TemplateNavigationSidebar/TemplateNavigationSidebar';
import { useGlobalSystemWarning } from '$web/client/hooks/useGlobalSystemWarning/useGlobalSystemWarning';
import './ADEPage.scss';
import {
  isAgentConvertingToTemplateAtom
} from '$web/client/components/ADEPage/DeploymentButton/CreateTemplateFromAgentButton/CreateTemplateFromAgentButton';

interface LoaderContentProps {
  isError?: boolean;
}

function LoaderContent(props: LoaderContentProps) {
  const { isError } = props;

  return (
    <VStack
      /* eslint-disable-next-line react/forbid-component-props */
      className="fixed z-draggedItem top-0 left-0 w-[100vw] h-[100dvh]"
      fullHeight
      fullWidth
      align="center"
      justify="center"
    >
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="loader-content" align="center" gap="large">
        <LettaLoader size="large" />
        <Typography>Setting up your workspace...</Typography>
        {isError && (
          <Alert
            title="There was an error setting up your workspace - please contact support"
            variant="destructive"
          />
        )}
      </VStack>
    </VStack>
  );
}

interface ADEPageProps {
  children: React.ReactNode;
}

function AgentPageError() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  return (
    <VStack gap="large" padding border fullWidth fullHeight flex align="center">
      <LoadingEmptyStatusComponent
        emptyMessage=""
        isError
        errorMessage={t('error')}
      />
    </VStack>
  );
}

export function ADEPage(props: ADEPageProps) {
  const { agentId } = useCurrentAgentMetaData();

  const { children } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const systemWarning = useGlobalSystemWarning();

  useAgentsServiceRetrieveAgent({
    agentId,
  });

  const isAgentConvertingToTemplate = useAtomValue(
    isAgentConvertingToTemplateAtom,
  );

  if (isAgentConvertingToTemplate) {
    return (
      <div className="w-[100dvw] h-[100dvh] flex flex-col items-center justify-center">
        <VStack
          gap="large"
          padding
          border
          fullWidth
          fullHeight
          flex
          align="center"
        >
          <LoadingEmptyStatusComponent
            emptyMessage=""
            isError
            errorMessage={t('convertingToTemplate')}
          />
        </VStack>
      </div>
    );
  }

  return (
    <VStack
      overflow="hidden"
      color="background"
      /* eslint-disable-next-line react/forbid-component-props */
      className={`w-[100vw] ade-page  ${systemWarning ? 'ade-page-system-warning' : 'h-[100dvh]'}`}
      fullHeight
      fullWidth
      gap={false}
    >
      <ADEHeader />
      <HStack collapseHeight overflowY="auto" fullWidth gap={false}>
        <TemplateNavigationSidebar />
        <div className="agent-page-fade-out fixed pointer-events-none z-[-1]">
          <LoaderContent />
        </div>
        <ErrorBoundary fallback={<AgentPageError />}>{children}</ErrorBoundary>
      </HStack>
    </VStack>
  );
}

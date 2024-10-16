'use client';
import type { panelRegistry } from './panelRegistry';
import { usePanelManager } from './panelRegistry';
import { PanelManagerProvider, PanelRenderer } from './panelRegistry';
import type { PanelItemPositionsMatrix } from '@letta-web/component-library';
import { toast } from '@letta-web/component-library';
import { LayoutIcon } from '@letta-web/component-library';
import {
  ADEHeader,
  ADEPage,
  Alert,
  ArrowUpIcon,
  Avatar,
  Button,
  Dialog,
  Frame,
  HStack,
  KeyIcon,
  LettaLoader,
  SupportIcon,
  Popover,
  Typography,
  DatabaseIcon,
  ForkIcon,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentProject } from '../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { useDebouncedValue } from '@mantine/hooks';
import { useFeatureFlag, webApi, webApiQueryKeys } from '$letta/client';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '$letta/client/hooks';
import { CurrentUserDetailsBlock } from '$letta/client/common';
import './AgentPage.scss';
import { useCurrentAgentMetaData } from './hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from './hooks';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { ContextWindowPreview } from './ContextEditorPanel/ContextEditorPanel';
import { generateDefaultADELayout } from '$letta/utils';

function RestoreLayoutButton() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { setPositions } = usePanelManager();

  const handleRestoreLayout = useCallback(() => {
    setPositions(generateDefaultADELayout().displayConfig);
  }, [setPositions]);

  return (
    <Button
      preIcon={<LayoutIcon />}
      hideLabel
      onClick={handleRestoreLayout}
      color="tertiary-transparent"
      label={t('restoreLayout')}
      size="small"
    />
  );
}

function NavOverlay() {
  const { slug: projectSlug } = useCurrentProject();
  const { name } = useCurrentUser();

  return (
    <Popover
      trigger={
        <HStack align="center">
          <Avatar size="small" name={name} />
        </HStack>
      }
      align="start"
    >
      <CurrentUserDetailsBlock />
      <Frame borderTop color="background-greyer" as="nav">
        <VStack as="ul" paddingY="small" paddingX="xsmall">
          <Button
            href={`/projects/${projectSlug}`}
            color="tertiary-transparent"
            preIcon={<ArrowUpIcon />}
            label="Return to Project"
          />
          <Button
            href="/data-sources"
            target="_blank"
            color="tertiary-transparent"
            label="Data Sources"
            preIcon={<DatabaseIcon />}
          />
          <Button
            target="_blank"
            href="/api-keys"
            color="tertiary-transparent"
            label="API Keys"
            preIcon={<KeyIcon />}
          />
          <Button
            target="_blank"
            href="/support"
            color="tertiary-transparent"
            label="Support"
            preIcon={<SupportIcon />}
          />
        </VStack>
      </Frame>
    </Popover>
  );
}

function ForkAgentDialog() {
  const { id: agentTemplateId } = useCurrentAgent();
  const { push } = useRouter();
  const { id: projectId, slug: projectSlug } = useCurrentProject();
  const { mutate, isPending } =
    webApi.agentTemplates.forkAgentTemplate.useMutation();

  const handleForkAgent = useCallback(() => {
    mutate(
      {
        params: {
          projectId,
          agentTemplateId: agentTemplateId,
        },
      },
      {
        onSuccess: (response) => {
          push(`/projects/${projectSlug}/agents/${response.body.name}`);
        },
      }
    );
  }, [agentTemplateId, mutate, projectId, projectSlug, push]);

  return (
    <Dialog
      title="Are you sure you want to Fork this agent?"
      confirmText="Fork Agent"
      onConfirm={handleForkAgent}
      isConfirmBusy={isPending}
      trigger={
        <Button
          hideLabel
          tooltipPlacement="bottom"
          size="small"
          color="tertiary-transparent"
          preIcon={<ForkIcon />}
          label="Fork Agent"
        ></Button>
      }
    >
      This will create a new agent with the same configuration as the current
      agent.
    </Dialog>
  );
}

interface LoaderContentProps {
  isError?: boolean;
}

function LoaderContent(props: LoaderContentProps) {
  const { isError } = props;

  return (
    <VStack
      /* eslint-disable-next-line react/forbid-component-props */
      className="fixed z-draggedItem top-0 left-0 w-[100vw] h-[100vh]"
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

export function AgentPage() {
  const { name: projectName, slug: projectSlug } = useCurrentProject();
  const { agentName, agentId, isTemplate, isLocal } = useCurrentAgentMetaData();
  const { data, isError } = webApi.adePreferences.getADEPreferences.useQuery({
    queryKey: webApiQueryKeys.adePreferences.getADEPreferences(agentId),
    queryData: {
      params: {
        agentId,
      },
    },
  });

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { data: agent } = useAgentsServiceGetAgent({
    agentId,
  });

  const { mutate } = webApi.adePreferences.updateADEPreferences.useMutation();

  const [updatedPositions, setUpdatedPositions] = useState<
    PanelItemPositionsMatrix<keyof typeof panelRegistry>
  >([]);

  const [debouncedPositions] = useDebouncedValue(updatedPositions, 500);

  useEffect(() => {
    if (debouncedPositions.length) {
      mutate({
        params: {
          agentId,
        },
        body: {
          displayConfig: debouncedPositions,
        },
      });
    }
  }, [agentId, debouncedPositions, mutate]);

  const { data: isContextEditorVisible } = useFeatureFlag(
    'SHOW_CONTEXT_EDITOR'
  );

  const fullPageWarning = useMemo(() => {
    if (isLocal) {
      return t('localAgentDevelopment');
    }

    if (!isTemplate) {
      return t('liveAgentWarning');
    }

    return null;
  }, [isLocal, isTemplate, t]);

  if (!data?.body?.displayConfig || !agent) {
    return <LoaderContent isError={isError} />;
  }

  return (
    <>
      <div className="agent-page-fade-out fixed pointer-events-none z-[-1]">
        <LoaderContent />
      </div>
      <PanelManagerProvider
        onPositionError={() => {
          toast.error(t('positionError'));
        }}
        fallbackPositions={generateDefaultADELayout().displayConfig}
        initialPositions={data.body.displayConfig}
        onPositionChange={setUpdatedPositions}
      >
        <ADEPage
          header={
            <ADEHeader
              project={{
                url: isLocal
                  ? '/local-project/agents'
                  : `/projects/${projectSlug}`,
                name: isLocal ? 'Local Project' : projectName,
              }}
              agent={{
                name: agentName,
              }}
            >
              <HStack paddingRight="small">
                {isContextEditorVisible && <ContextWindowPreview />}
                {isTemplate && <ForkAgentDialog />}
                <RestoreLayoutButton />
                <NavOverlay />
              </HStack>
            </ADEHeader>
          }
        >
          <VStack overflow="hidden" position="relative" fullWidth fullHeight>
            {fullPageWarning && (
              <Alert variant="warning" title={fullPageWarning} />
            )}
            <Frame overflow="hidden" position="relative" fullWidth fullHeight>
              <PanelRenderer />
            </Frame>
          </VStack>
        </ADEPage>
      </PanelManagerProvider>
    </>
  );
}

'use client';
import type { panelRegistry } from './panelRegistry';
import { PanelOpener } from './panelRegistry';
import { PanelManagerProvider, PanelRenderer } from './panelRegistry';
import type { PanelItemPositionsMatrix } from '@letta-web/component-library';
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
  LifebuoyIcon,
  Logo,
  Popover,
  Typography,
  VStack,
} from '@letta-web/component-library';
import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { useCurrentProject } from '../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { DatabaseIcon, GitForkIcon } from 'lucide-react';
import { useDebouncedValue } from '@mantine/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '$letta/client/hooks';
import { CurrentUserDetailsBlock } from '$letta/client/common';
import './AgentPage.scss';
import { useCurrentAgentMetaData } from './hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from './hooks';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';

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
            preIcon={<LifebuoyIcon />}
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
  const { mutate, isPending } = webApi.projects.forkAgentTemplate.useMutation();

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
          color="black"
          preIcon={<GitForkIcon />}
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
  const { data, isError } = webApi.adePreferences.getADEPreferences.useQuery({
    queryKey: webApiQueryKeys.adePreferences.getADEPreferences,
    queryData: {},
  });

  const { agentName, agentId, isTemplate } = useCurrentAgentMetaData();

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
        body: {
          displayConfig: debouncedPositions,
        },
      });
    }
  }, [debouncedPositions, mutate]);

  if (!data?.body?.displayConfig || !agent) {
    return <LoaderContent isError={isError} />;
  }

  return (
    <>
      <div className="agent-page-fade-out fixed pointer-events-none z-[-1]">
        <LoaderContent />
      </div>
      <PanelManagerProvider
        initialPositions={data.body.displayConfig}
        onPositionChange={setUpdatedPositions}
      >
        <ADEPage
          header={
            <ADEHeader>
              <HStack align="center">
                <Link target="_blank" href="/">
                  <Logo size="small" color="white" />
                </Link>
                /
                <Link target="_blank" href={`/projects/${projectSlug}`}>
                  <Typography color="white">{projectName}</Typography>
                </Link>
                /
                <PanelOpener
                  templateId="agent-config"
                  data={undefined}
                  id="agent-config"
                >
                  <Typography color="white">{agentName}</Typography>
                </PanelOpener>
              </HStack>
              <HStack>
                {isTemplate && <ForkAgentDialog />}
                <NavOverlay />
              </HStack>
            </ADEHeader>
          }
        >
          <VStack overflow="hidden" position="relative" fullWidth fullHeight>
            {!isTemplate && (
              <Alert
                variant="warning"
                title="You are editing a live agent, be aware that editing this agent may impact live deployments"
              />
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

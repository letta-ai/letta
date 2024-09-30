'use client';
import type { panelRegistry } from './panelRegistry';
import {
  PanelManagerProvider,
  PanelOpener,
  PanelRenderer,
} from './panelRegistry';
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useCurrentProject,
  useCurrentProjectId,
} from '../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { DatabaseIcon, GitForkIcon } from 'lucide-react';
import { useCurrentAgentId } from './hooks';
import { useCurrentAgentTemplate } from './hooks/useCurrentAgentTemplate/useCurrentAgentTemplate';
import { useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '$letta/client/hooks';
import { CurrentUserDetailsBlock } from '$letta/client/common';
import './AgentPage.scss';

const MIN_INPUT_WIDTH = 50;
const MAX_INPUT_WIDTH = 500;
function InlineAgentTemplateNameChanger() {
  const { name: defaultName } = useCurrentAgentTemplate();

  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(defaultName);
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const agentTemplateId = useCurrentAgentId();

  const [debouncedName] = useDebouncedValue(name, 500);
  const { mutate } = webApi.projects.updateProjectAgentTemplate.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.projects.getProjectAgentTemplate(
          projectId,
          agentTemplateId
        ),
      });
    },
  });

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    // measure width of the name using HTML Canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.font = '14px Overused Grotesk';
    const textWidth = context.measureText(name).width;

    const nextWidth = Math.min(
      Math.max(textWidth + 10, MIN_INPUT_WIDTH),
      MAX_INPUT_WIDTH
    );

    inputRef.current.style.width = `${nextWidth}px`;
  }, [name]);

  useEffect(() => {
    if (!debouncedName) {
      return;
    }

    mutate({
      body: { name: debouncedName },
      params: {
        projectId,
        agentTemplateId,
      },
    });
  }, [debouncedName, mutate, projectId, agentTemplateId]);

  return (
    <HStack>
      <input
        ref={inputRef}
        style={{ width: name.length * 10 }}
        className="text-white bg-transparent border-none focus:outline-none focus:border-b focus:border-b-white focus:border-solid text-base"
        value={name}
        onChange={(event) => {
          setName(event.currentTarget.value);
        }}
      />
    </HStack>
  );
}

function NavOverlay() {
  const currentProjectId = useCurrentProjectId();
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
            href={`/projects/${currentProjectId}`}
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
  const currentagentTemplateId = useCurrentAgentId();
  const { push } = useRouter();
  const projectId = useCurrentProjectId();
  const { mutate, isPending } = webApi.projects.forkAgentTemplate.useMutation();

  const handleForkAgent = useCallback(() => {
    mutate(
      {
        params: {
          projectId,
          agentTemplateId: currentagentTemplateId,
        },
      },
      {
        onSuccess: (response) => {
          push(`/projects/${projectId}/agents/${response.body.id}`);
        },
      }
    );
  }, [mutate, projectId, currentagentTemplateId, push]);

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

function OpenDeploymentManagerPanel() {
  return (
    <PanelOpener templateId="deployment" id="deployment" data={undefined}>
      <Button
        tooltipPlacement="bottom"
        size="small"
        color="tertiary"
        label="Template Version Manager"
      ></Button>
    </PanelOpener>
  );
}

interface LoaderContentProps {
  isError?: boolean;
}

function LoaderContent(props: LoaderContentProps) {
  const { isError } = props;

  return (
    <VStack
      className="fixed z-draggedItem top-0 left-0 w-[100vw] h-[100vh]"
      fullHeight
      fullWidth
      align="center"
      justify="center"
    >
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
  const { name: projectName, id: projectId } = useCurrentProject();
  const { data, isError } = webApi.adePreferences.getADEPreferences.useQuery({
    queryKey: webApiQueryKeys.adePreferences.getADEPreferences,
    queryData: {},
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

  if (!data?.body?.displayConfig) {
    return <LoaderContent isError={isError} />;
  }

  return (
    <>
      <div className="agent-page-fade-out pointer-events-none z-[-1]">
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
                <Link target="_blank" href={`/projects/${projectId}`}>
                  <Typography color="white">{projectName}</Typography>
                </Link>
                /<InlineAgentTemplateNameChanger />
              </HStack>
              <HStack>
                <ForkAgentDialog />
                <OpenDeploymentManagerPanel />
                <NavOverlay />
              </HStack>
            </ADEHeader>
          }
        >
          <Frame overflow="hidden" className="relative" fullWidth fullHeight>
            <PanelRenderer />
          </Frame>
        </ADEPage>
      </PanelManagerProvider>
    </>
  );
}

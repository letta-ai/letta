'use client';
import type { panelRegistry } from './panelRegistry';
import { usePanelManager } from './panelRegistry';
import {
  PanelManagerProvider,
  PanelOpener,
  PanelRenderer,
} from './panelRegistry';
import {
  ADEHeader,
  ADEPage,
  ArrowUpIcon,
  Avatar,
  Button,
  ChatBubbleIcon,
  Dialog,
  Frame,
  HStack,
  KeyIcon,
  LifebuoyIcon,
  Logo,
  MaybeTooltip,
  Popover,
  Typography,
  VStack,
} from '@letta-web/component-library';
import Link from 'next/link';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useCurrentProject,
  useCurrentProjectId,
} from '../../../../../(dashboard-like)/projects/[projectId]/hooks';
import {
  BotIcon,
  BrainIcon,
  BrickWallIcon,
  DatabaseIcon,
  GitForkIcon,
  PenToolIcon,
  Settings2Icon,
} from 'lucide-react';
import { cn } from '@letta-web/core-style-config';
import { Slot } from '@radix-ui/react-slot';
import {
  useADESidebarContext,
  useCurrentAgent,
  useCurrentTestingAgentId,
} from './hooks';
import { useCurrentTestingAgent } from './hooks/useCurrentTestingAgent/useCurrentTestingAgent';
import { useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '$letta/client/hooks';
import { CurrentUserDetailsBlock } from '$letta/client/common';

type PanelRegistryKeys = keyof typeof panelRegistry;

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
}

function SidebarGroup(props: SidebarGroupProps) {
  const { title, children } = props;
  const { collapsed } = useADESidebarContext();

  return (
    <VStack
      borderBottom
      paddingBottom
      gap={false}
      color="transparent"
      as="section"
    >
      <HStack className="h-[43px]" paddingX="small" align="center">
        {!collapsed && (
          <Typography bold variant="body2">
            {title}
          </Typography>
        )}
      </HStack>
      <VStack gap="small" as="ul">
        {children}
      </VStack>
    </VStack>
  );
}

interface AgentPanelSidebarItemProps<
  TPanelTemplateId extends PanelRegistryKeys
> {
  label: string;
  icon: React.ReactNode;
  preview?: React.ReactNode;
  templateId: TPanelTemplateId;
  data: (typeof panelRegistry)[TPanelTemplateId]['data']['_output'];
  id: string;
}

function AgentPanelSidebarItem<TPanelTemplateId extends PanelRegistryKeys>(
  props: AgentPanelSidebarItemProps<TPanelTemplateId>
) {
  const { label, icon, templateId, preview, id, data } = props;
  const { getIsPanelTemplateActive } = usePanelManager();

  const isActive = useMemo(() => {
    return getIsPanelTemplateActive(templateId);
  }, [getIsPanelTemplateActive, templateId]);

  const collapsed = false;

  return (
    <MaybeTooltip renderTooltip={false} placement="right" content={label}>
      <HStack fullWidth align="center" paddingX="small">
        <PanelOpener id={id} templateId={templateId} data={data}>
          <HStack
            fullWidth
            data-testid={`ade-navigate-to:${label}`}
            paddingX="small"
            rounded
            className={cn(
              'hover:bg-background-grey-hover cursor-pointer h-[30px]'
            )}
            color="transparent"
            justify="spaceBetween"
            align="center"
          >
            <HStack align="center">
              <Slot className="w-3 h-3">{icon}</Slot>
              {!collapsed && (
                <Typography noWrap variant="body2">
                  {label}
                </Typography>
              )}
            </HStack>
            {!collapsed && (
              <HStack align="center">
                <Typography variant="body2" color="muted">
                  {preview}
                </Typography>
                <HStack align="center" className="w-3">
                  {isActive && (
                    <div className="min-w-2 min-h-2 bg-background-black rounded-full" />
                  )}
                </HStack>
              </HStack>
            )}
          </HStack>
        </PanelOpener>
      </HStack>
    </MaybeTooltip>
  );
}

function AgentPageSidebar() {
  const currentAgent = useCurrentAgent();

  return (
    <VStack
      fullHeight
      borderRight
      color="background-grey"
      as="nav"
      width="sidebar"
      justify="spaceBetween"
      overflowY="auto"
      overflowX="hidden"
    >
      <VStack>
        <SidebarGroup title="Base">
          <AgentPanelSidebarItem
            label="Model"
            icon={<BotIcon />}
            preview={currentAgent.llm_config.model}
            templateId="model-details"
            data={undefined}
            id="model-details"
          />
          <AgentPanelSidebarItem
            label="Config"
            icon={<Settings2Icon />}
            templateId="agent-config"
            data={undefined}
            id="agent-config"
          />
        </SidebarGroup>
        <SidebarGroup title="Configure">
          <AgentPanelSidebarItem
            label="Memory Blocks"
            icon={<BrickWallIcon />}
            templateId="memory-blocks"
            data={undefined}
            id="memory-blocks"
          />
          <AgentPanelSidebarItem
            label="Data Sources"
            icon={<DatabaseIcon />}
            templateId="data-sources-panel"
            data={undefined}
            id="data-sources-panel"
          />
          <AgentPanelSidebarItem
            label="Tools"
            icon={<PenToolIcon />}
            templateId="tools-panel"
            data={undefined}
            id="tools-panel"
          />
        </SidebarGroup>
        <SidebarGroup title="Test">
          <AgentPanelSidebarItem
            label="Simulator"
            icon={<ChatBubbleIcon />}
            templateId="agent-simulator"
            data={undefined}
            id="simulator"
          />
          <AgentPanelSidebarItem
            label="Archival Memories"
            icon={<BrainIcon />}
            templateId="archival-memories"
            data={{}}
            id="archival-memories"
          />
        </SidebarGroup>
      </VStack>
    </VStack>
  );
}

const MIN_INPUT_WIDTH = 50;
const MAX_INPUT_WIDTH = 500;
function InlineTestingAgentNameChanger() {
  const { name: defaultName } = useCurrentTestingAgent();

  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(defaultName);
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const testingAgentId = useCurrentTestingAgentId();

  const [debouncedName] = useDebouncedValue(name, 500);
  const { mutate } = webApi.projects.updateProjectTestingAgent.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.projects.getProjectTestingAgent(
          projectId,
          testingAgentId
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
        testingAgentId,
      },
    });
  }, [debouncedName, mutate, projectId, testingAgentId]);

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
  const currentTestingAgentId = useCurrentTestingAgentId();
  const { push } = useRouter();
  const projectId = useCurrentProjectId();
  const { mutate, isPending } = webApi.projects.forkTestingAgent.useMutation();

  const handleForkAgent = useCallback(() => {
    mutate(
      {
        params: {
          projectId,
          testingAgentId: currentTestingAgentId,
        },
      },
      {
        onSuccess: (response) => {
          push(`/projects/${projectId}/agents/${response.body.id}`);
        },
      }
    );
  }, [mutate, projectId, currentTestingAgentId, push]);

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
        label="Deployment Manager"
      ></Button>
    </PanelOpener>
  );
}

export function AgentPage() {
  const { name: projectName, id: projectId } = useCurrentProject();

  return (
    <PanelManagerProvider
      initialPositions={[
        {
          size: 100,
          positions: [
            {
              size: 100,
              positions: [
                {
                  id: 'simulator',
                  isActive: true,
                  templateId: 'agent-simulator',
                  data: undefined,
                },
              ],
            },
          ],
        },
        {
          size: 100,
          positions: [
            {
              size: 100,
              positions: [
                {
                  id: 'archival-memories',
                  isActive: false,
                  templateId: 'archival-memories',
                  data: undefined,
                },
                {
                  id: 'welcome',
                  isActive: true,
                  templateId: 'welcome-panel',
                  data: undefined,
                },
              ],
            },
          ],
        },
      ]}
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
              /<InlineTestingAgentNameChanger />
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
        <AgentPageSidebar />
      </ADEPage>
    </PanelManagerProvider>
  );
}

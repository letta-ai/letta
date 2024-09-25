'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ADEHeader,
  ADEPage,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  Avatar,
  Button,
  Dialog,
  Frame,
  HStack,
  KeyIcon,
  LifebuoyIcon,
  Logo,
  PanelManager,
  PanelRenderArea,
  Popover,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { ADENavigationItem } from './common/ADENavigationItem/ADENavigationItem';
import { ToolsPanel } from './ToolsPanel/ToolsPanel';
import { DataSourcesPanel } from './DataSourcesPanel/DataSourcesPanel';
import { ModelPanel } from './ModelPanel/ModelPanel';
import { AgentSimulator } from './AgentSimulator/AgentSimulator';
import { VariablesPanel } from './VariablesPanel/VariablesPanel';
import { MemoryBlocksPanel } from './MemoryBlocksPanel/MemoryBlocksPanel';
import { ContextEditorPanel } from './ContextEditorPanel/ContextEditorPanel';
import { CurrentUserDetailsBlock } from '$letta/client/common';
import {
  useCurrentProject,
  useCurrentProjectId,
} from '../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { useFeatureFlag, webApi, webApiQueryKeys } from '$letta/client';
import { ArchivalMemoriesPanel } from './ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import { DatabaseIcon, GitForkIcon, SettingsIcon } from 'lucide-react';
import { DeploymentAgentMangerPanel } from './DeploymentAgentMangerPanel/DeploymentAgentMangerPanel';
import { ConfigPanel } from './ConfigPanel/ConfigPanel';
import { useCurrentTestingAgent } from './hooks/useCurrentTestingAgent/useCurrentTestingAgent';
import { useDebouncedValue, useLocalStorage } from '@mantine/hooks';
import {
  ADESidebarProvider,
  useADESidebarContext,
  useCurrentTestingAgentId,
} from './hooks';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '$letta/client/hooks';

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
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

function ADESidebar() {
  const [collapsed, setCollapsed] = useLocalStorage({
    defaultValue: false,
    key: 'ADESidebarCollapsed',
  });
  const { data: showVariablesEditor } = useFeatureFlag('SHOW_VARIABLES_EDITOR');
  const { data: showParametersEditor } = useFeatureFlag(
    'SHOW_PARAMETERS_EDITOR'
  );
  const { data: showContextEditor } = useFeatureFlag('SHOW_CONTEXT_EDITOR');

  return (
    <ADESidebarProvider collapsed={collapsed}>
      <VStack
        fullHeight
        borderRight
        color="background-grey"
        as="nav"
        justify="spaceBetween"
        overflowY="auto"
        overflowX="hidden"
        className={`transition-all duration-200 ${
          collapsed ? 'w-[55px]' : 'w-[250px]'
        }`}
      >
        <VStack>
          <SidebarGroup title="Base">
            <ModelPanel />
            <ConfigPanel />
            {showParametersEditor && (
              <ADENavigationItem icon={<SettingsIcon />} title="Parameters" />
            )}
          </SidebarGroup>
          <SidebarGroup title="Configure">
            {showVariablesEditor && <VariablesPanel />}
            <MemoryBlocksPanel />
            <DataSourcesPanel />
            <ToolsPanel />
            {showContextEditor && <ContextEditorPanel />}
          </SidebarGroup>
          <SidebarGroup title="Test">
            <ArchivalMemoriesPanel />
            <AgentSimulator />
          </SidebarGroup>
        </VStack>
        <HStack paddingX="small">
          <Button
            tooltipPlacement="right"
            label={collapsed ? 'Expand' : 'Collapse'}
            hideLabel
            active={collapsed}
            color="tertiary-transparent"
            preIcon={collapsed ? <ArrowRightIcon /> : <ArrowLeftIcon />}
            onClick={() => {
              setCollapsed(!collapsed);
            }}
          />
        </HStack>
      </VStack>
    </ADESidebarProvider>
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

export function AgentPage() {
  const { name: projectName, id: projectId } = useCurrentProject();
  return (
    <PanelManager>
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
              /
              <InlineTestingAgentNameChanger />
            </HStack>
            <HStack>
              <ForkAgentDialog />
              <DeploymentAgentMangerPanel />
              <NavOverlay />
            </HStack>
          </ADEHeader>
        }
      >
        <Frame overflow="hidden" className="relative" fullWidth fullHeight>
          <PanelRenderArea />
        </Frame>
        <ADESidebar />
      </ADEPage>
    </PanelManager>
  );
}

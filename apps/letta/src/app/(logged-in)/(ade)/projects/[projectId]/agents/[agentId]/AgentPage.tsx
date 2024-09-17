'use client';
import React, { useCallback, useState } from 'react';
import {
  ADEHeader,
  ADEPage,
  ArrowUpIcon,
  Button,
  CaretDownIcon,
  Dialog,
  Frame,
  HomeIcon,
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
import { useCurrentProjectId } from '../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys, useFeatureFlag } from '$letta/client';
import { useCurrentTestingAgentId } from './hooks';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/deploy-agent-reference';
import { ArchivalMemoriesPanel } from './ArchivalMemoriesPanel/ArchivalMemoriesPanel';

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
}

function NavOverlay() {
  const currentProjectId = useCurrentProjectId();

  return (
    <Popover
      trigger={
        <HStack align="center">
          <Logo size="small" color="white" />
          <CaretDownIcon className="w-1.5" color="white" />
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
            href="/"
            color="tertiary-transparent"
            label="Dashboard"
            preIcon={<HomeIcon />}
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

  return (
    <VStack
      borderBottom
      paddingBottom
      gap={false}
      color="transparent"
      as="section"
    >
      <HStack className="h-[43px]" paddingX="small" align="center">
        <Typography bold variant="body2">
          {title}
        </Typography>
      </HStack>
      <VStack gap="small" as="ul">
        {children}
      </VStack>
    </VStack>
  );
}

function ADESidebar() {
  const { data: showVariablesEditor } = useFeatureFlag('SHOW_VARIABLES_EDITOR');
  const { data: showParametersEditor } = useFeatureFlag(
    'SHOW_PARAMETERS_EDITOR'
  );
  const { data: showContextEditor } = useFeatureFlag('SHOW_CONTEXT_EDITOR');

  return (
    <VStack
      borderRight
      color="background-grey"
      as="nav"
      fullHeight
      overflowY="auto"
      className="w-[250px] min-w-[250px]"
    >
      <SidebarGroup title="Base">
        <ModelPanel />
        {showParametersEditor && <ADENavigationItem title="Parameters" />}
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
  );
}

function StageAndDeployDialog() {
  const testingAgentId = useCurrentTestingAgentId();
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();

  const [sourceAgentId, setSourceAgentId] = useState<string>();
  const { mutate, isPending } =
    webApi.projects.createProjectSourceAgentFromTestingAgent.useMutation({
      onSuccess: (response) => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjectSourceAgents(projectId),
        });

        setSourceAgentId(response.body.id);
      },
    });

  const handleCreateSourceAgent = useCallback(() => {
    mutate({ body: { testingAgentId }, params: { projectId } });
  }, [mutate, testingAgentId, projectId]);

  if (sourceAgentId) {
    return (
      <Dialog
        size="large"
        title="Congratulations! Your agent has been staged."
        hideConfirm
        onOpenChange={(open) => {
          if (!open) {
            setSourceAgentId(undefined);
          }
        }}
      >
        <DeployAgentUsageInstructions
          sourceAgentId={sourceAgentId}
          projectId={projectId}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Are you sure you want to stage your agent?"
      onConfirm={handleCreateSourceAgent}
      isConfirmBusy={isPending}
      trigger={<Button color="primary" size="small" label="Stage Agent" />}
    >
      This will allow your agent to be deployed to the cloud and used in
      production. Are you sure you want to stage your agent?
    </Dialog>
  );
}

export function AgentPage() {
  return (
    <PanelManager>
      <ADEPage
        header={
          <ADEHeader>
            <NavOverlay />
            <HStack>
              <StageAndDeployDialog />
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

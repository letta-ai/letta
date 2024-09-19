'use client';
import React from 'react';
import {
  ADEHeader,
  ADEPage,
  ArrowUpIcon,
  Button,
  CaretDownIcon,
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
import { useCurrentProjectId } from '../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { useFeatureFlag } from '$letta/client';
import { ArchivalMemoriesPanel } from './ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import { DatabaseIcon } from 'lucide-react';
import { StagedAgentsPanel } from './StagedAgentsPanel/StagedAgentsPanel';
import { ConfigPanel } from './ConfigPanel/ConfigPanel';
import { useCurrentTestingAgent } from './hooks/useCurrentTestingAgent/useCurrentTestingAgent';

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
        <ConfigPanel />
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

export function AgentPage() {
  const { name } = useCurrentTestingAgent();
  return (
    <PanelManager>
      <ADEPage
        header={
          <ADEHeader>
            <NavOverlay />
            <VStack
              className="pointer-events-none"
              fullHeight
              fullWidth
              position="absolute"
              align="center"
              justify="center"
            >
              <Typography className="absolute" color="white">
                {name}
              </Typography>
            </VStack>
            <HStack>
              <StagedAgentsPanel />
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

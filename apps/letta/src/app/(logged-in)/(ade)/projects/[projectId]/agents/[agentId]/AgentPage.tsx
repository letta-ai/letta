'use client';
import React from 'react';
import {
  ADEHeader,
  ADEPage,
  ArrowLeftIcon,
  ArrowRightIcon,
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
import { DatabaseIcon, SettingsIcon } from 'lucide-react';
import { StagedAgentsPanel } from './StagedAgentsPanel/StagedAgentsPanel';
import { ConfigPanel } from './ConfigPanel/ConfigPanel';
import { useCurrentTestingAgent } from './hooks/useCurrentTestingAgent/useCurrentTestingAgent';
import { useLocalStorage } from '@mantine/hooks';
import { ADESidebarProvider, useADESidebarContext } from './hooks';

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

'use client';
import React from 'react';
import {
  Button,
  Frame,
  HStack,
  Logo,
  PanelManager,
  PanelRenderArea,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { ADENavigationItem } from './common/ADENavigationItem/ADENavigationItem';
import { ToolsPanel } from './ToolsPanel/ToolsPanel';
import { DataSourcesPanel } from './DataSourcesPanel/DataSourcesPanel';
import { ModelPanel } from './ModelPanel/ModelPanel';
import { AgentSimulator } from './AgentSimulator/AgentSimulator';
import { VariablesPanel } from './VariablesPanel/VariablesPanel';

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
}

function SidebarGroup(props: SidebarGroupProps) {
  const { title, children } = props;

  return (
    <VStack borderBottom gap={false} color="transparent" as="section">
      <HStack className="h-[43px]" paddingX="xxsmall" align="center">
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
  return (
    <VStack
      borderRight
      color="background-grey"
      as="nav"
      fullHeight
      className="w-[250px] min-w-[250px]"
    >
      <SidebarGroup title="Base">
        <ModelPanel />
        <ADENavigationItem title="Parameters" />
      </SidebarGroup>
      <SidebarGroup title="Configure">
        <VariablesPanel />
        <ADENavigationItem title="Memory Blocks" />
        <DataSourcesPanel />
        <ToolsPanel />
        <ADENavigationItem title="Context Editor" />
      </SidebarGroup>
      <SidebarGroup title="Test">
        {/*<ArchivalMemoriesPanel />*/}
        <AgentSimulator />
      </SidebarGroup>
    </VStack>
  );
}

function ADEHeader() {
  return (
    <HStack
      justify="spaceBetween"
      align="center"
      padding="xxsmall"
      className="h-[48px] min-h-[48px]"
      fullWidth
      color="background-black"
    >
      <div>
        <Logo size="small" color="white" />
      </div>
      <HStack>
        <Button color="primary" size="small" label="Deployment Instructions" />
      </HStack>
    </HStack>
  );
}

export function AgentPage() {
  return (
    <PanelManager>
      <VStack
        overflow="hidden"
        color="background-grey"
        className="w-[100vw] h-[100vh]"
        fullHeight
        fullWidth
        gap={false}
      >
        <ADEHeader />
        <HStack collapseHeight overflowY="auto" fullWidth gap={false}>
          <ADESidebar />
          <Frame overflow="hidden" className="relative" fullWidth fullHeight>
            <PanelRenderArea initialPositions={['sidebar']} />
          </Frame>
        </HStack>
      </VStack>
    </PanelManager>
  );
}

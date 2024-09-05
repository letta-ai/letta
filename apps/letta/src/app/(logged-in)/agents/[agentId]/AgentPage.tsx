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
import { NavigationItem } from './common/ADENavigationItem/ADENavigationItem';
import { ToolsPanel } from './ToolsPanel/ToolsPanel';
import { DataSourcesPanel } from './DataSourcesPanel/DataSourcesPanel';
import { ModelPanel } from './ModelPanel/ModelPanel';
import { AgentSimulator } from './AgentSimulator/AgentSimulator';

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
}

function SidebarGroup(props: SidebarGroupProps) {
  const { title, children } = props;

  return (
    <VStack borderBottom gap={false} color="transparent" as="section">
      <HStack
        className="h-[43px]"
        padding="xxsmall"
        borderBottom
        align="center"
      >
        <Typography bold variant="body2">
          {title}
        </Typography>
      </HStack>
      <VStack gap={false} as="ul">
        {children}
      </VStack>
    </VStack>
  );
}

function ADESidebar() {
  return (
    <VStack
      borderRight
      gap={false}
      color="background-greyer"
      as="nav"
      fullHeight
      className="w-[250px] min-w-[250px]"
    >
      <SidebarGroup title="Core Details">
        <ModelPanel />
        <NavigationItem title="Parameters" />
      </SidebarGroup>
      <SidebarGroup title="Powers">
        <NavigationItem title="Core Memories" />
        <NavigationItem title="Archival Memories" />
        <DataSourcesPanel />
        <ToolsPanel />
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
        <AgentSimulator />
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
        <HStack className="h-[0] flex-1" overflowY="auto" fullWidth gap={false}>
          <ADESidebar />
          <Frame overflow="hidden" fullWidth fullHeight>
            <PanelRenderArea initialPositions={['sidebar']} />
          </Frame>
        </HStack>
      </VStack>
    </PanelManager>
  );
}

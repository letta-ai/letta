'use client';
import React from 'react';
import {
  Frame,
  HStack,
  PanelManager,
  PanelRenderArea,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { ADEHeader } from './ADEHeader/ADEHeader';
import { NavigationItem } from './common/ADENavigationItem/ADENavigationItem';
import { ToolsPanel } from './ToolsPanel/ToolsPanel';
import { DataSourcesPanel } from './DataSourcesPanel/DataSourcesPanel';

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
}

function SidebarGroup(props: SidebarGroupProps) {
  const { title, children } = props;

  return (
    <VStack borderBottom gap={false} color="transparent" as="section">
      <HStack className="h-[36px]" padding="xxsmall" align="center">
        <Typography
          className="border-b border-primary border-b-2"
          bold
          variant="body2"
        >
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
      as="nav"
      fullHeight
      className="w-[250px] min-w-[250px]"
      color="background"
    >
      <SidebarGroup title="Core Details">
        <NavigationItem title="Model" />
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

export function AgentsAgentPage() {
  return (
    <PanelManager>
      <VStack
        color="background-grey"
        className="w-[100vw] h-[100vh]"
        fullHeight
        fullWidth
        gap={false}
      >
        <ADEHeader />
        <HStack fullWidth fullHeight gap={false}>
          <ADESidebar />
          <Frame padding="xxxsmall" fullWidth fullHeight>
            <PanelRenderArea />
          </Frame>
        </HStack>
      </VStack>
    </PanelManager>
  );
}

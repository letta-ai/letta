'use client';
import React from 'react';
import {
  ArrowUpIcon,
  Button,
  CaretDownIcon,
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

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
}

function NavOverlay() {
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
        <VStack as="ul" paddingY="xxsmall" paddingX="xxxsmall">
          <Button
            href="/project"
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
        <MemoryBlocksPanel />
        <DataSourcesPanel />
        <ToolsPanel />
        <ContextEditorPanel />
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
      <NavOverlay />

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
        <HStack
          collapseHeight
          overflowY="auto"
          fullWidth
          gap={false}
          className="flex-row-reverse"
        >
          <Frame overflow="hidden" className="relative" fullWidth fullHeight>
            <PanelRenderArea />
          </Frame>
          <ADESidebar />
        </HStack>
      </VStack>
    </PanelManager>
  );
}

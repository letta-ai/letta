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
  Button,
  Frame,
  HStack,
  Logo,
  Typography,
  VStack,
} from '@letta-web/component-library';
import Link from 'next/link';
import React from 'react';
import { useCurrentProject } from '../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { BotIcon, BrainIcon, Settings2Icon } from 'lucide-react';

type PanelRegistryKeys = keyof typeof panelRegistry;

interface AgentPanelSidebarItemProps<
  TPanelTemplateId extends PanelRegistryKeys
> {
  label: string;
  icon: React.ReactNode;
  templateId: TPanelTemplateId;
  data: (typeof panelRegistry)[TPanelTemplateId]['data']['_output'];
  id: string;
}

function AgentPanelSidebarItem<TPanelTemplateId extends PanelRegistryKeys>(
  props: AgentPanelSidebarItemProps<TPanelTemplateId>
) {
  const { label, icon, templateId, id, data } = props;
  const { getIsPanelTemplateActive } = usePanelManager();

  const isActive = getIsPanelTemplateActive(templateId);

  return (
    <PanelOpener id={id} templateId={templateId} data={data}>
      <Button
        color="tertiary-transparent"
        active={isActive}
        label={label}
        preIcon={icon}
      />
    </PanelOpener>
  );
}

function AgentPageSidebar() {
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
        <AgentPanelSidebarItem
          label="Config"
          icon={<Settings2Icon />}
          templateId="agent-config"
          data={undefined}
          id="agent-config"
        />
        <AgentPanelSidebarItem
          label="Simulator"
          icon={<BotIcon />}
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
      </VStack>
    </VStack>
  );
}

export function NextAgentPage() {
  const { name: projectName, id: projectId } = useCurrentProject();

  return (
    <PanelManagerProvider
      initialPositions={[
        [
          [
            {
              id: 'simulator',
              isActive: true,
              templateId: 'agent-simulator',
              data: undefined,
            },
          ],
        ],
        [
          [
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
        ],
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
              /<Typography color="white">{projectName}</Typography>
            </HStack>
            <HStack>
              {/*<ForkAgentDialog />*/}
              {/*<DeploymentAgentMangerPanel />*/}
              {/*<NavOverlay />*/}
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

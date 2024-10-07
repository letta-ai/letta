import React, { useMemo } from 'react';
import { useADESidebarContext, useCurrentAgent } from '../hooks';
import type { PanelTemplate } from '@letta-web/component-library';
import { ADESidebarButton } from '@letta-web/component-library';
import {
  ChatBubbleIcon,
  HStack,
  MaybeTooltip,
  Typography,
  VStack,
} from '@letta-web/component-library';
import type { panelRegistry } from '../panelRegistry';
import { PanelToggle, usePanelManager } from '../panelRegistry';
import {
  BotIcon,
  BoxesIcon,
  BrainIcon,
  BrickWallIcon,
  DatabaseIcon,
  PenToolIcon,
  Settings2Icon,
} from 'lucide-react';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';

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
      <HStack paddingY="small" paddingX="small" align="center">
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

  return (
    <MaybeTooltip renderTooltip={false} placement="right" content={label}>
      <HStack fullWidth align="center" paddingX="small">
        <PanelToggle id={id} templateId={templateId} data={data}>
          <ADESidebarButton
            label={label}
            icon={icon}
            preview={preview}
            isActive={isActive}
          />
        </PanelToggle>
      </HStack>
    </MaybeTooltip>
  );
}

function MemoryBlocksSidebar() {
  const t = useTranslations('ADE/ADESidebar');
  const agent = useCurrentAgent();

  const memoryBlocks = useMemo(() => {
    return Object.values(agent?.memory?.memory || {});
  }, [agent]);

  return (
    <>
      <AgentPanelSidebarItem
        label={t('nav.memoryBlocks')}
        icon={<BrickWallIcon />}
        templateId="memory-blocks"
        data={undefined}
        id="memory-blocks"
      />
      <div className="ml-3">
        {memoryBlocks.map((block) => (
          <AgentPanelSidebarItem
            key={block.id}
            label={block.name || 'Unnamed Block'}
            icon={<BrickWallIcon />}
            templateId="edit-memory-block"
            data={{
              label: block.label || '',
              name: block.name || '',
              blockId: block.id || '',
            }}
            id={`memory-blocks-edit-${block.id}`}
          />
        ))}
      </div>
    </>
  );
}

function AgentPageSidebar() {
  const currentAgent = useCurrentAgent();
  const t = useTranslations('ADE/ADESidebar');
  const { isTemplate } = useCurrentAgentMetaData();

  return (
    <VStack
      fullHeight
      borderRight
      color="background-grey"
      as="nav"
      fullWidth
      justify="spaceBetween"
      overflowY="auto"
      overflowX="hidden"
    >
      <VStack>
        <SidebarGroup title={t('nav.base')}>
          <AgentPanelSidebarItem
            label={t('nav.model')}
            icon={<BotIcon />}
            preview={currentAgent.llm_config.model}
            templateId="model-details"
            data={undefined}
            id="model-details"
          />
          <AgentPanelSidebarItem
            label={t('nav.config')}
            icon={<Settings2Icon />}
            templateId="agent-config"
            data={undefined}
            id="agent-config"
          />
        </SidebarGroup>
        <SidebarGroup title={t('nav.configure')}>
          <MemoryBlocksSidebar />
          <AgentPanelSidebarItem
            label={t('nav.dataSources')}
            icon={<DatabaseIcon />}
            templateId="data-sources-panel"
            data={undefined}
            id="data-sources-panel"
          />
          <AgentPanelSidebarItem
            label={t('nav.tools')}
            icon={<PenToolIcon />}
            templateId="tools-panel"
            data={undefined}
            id="tools-panel"
          />
        </SidebarGroup>
        <SidebarGroup title={t('nav.test')}>
          <AgentPanelSidebarItem
            label={t('nav.agentSimulator')}
            icon={<ChatBubbleIcon />}
            templateId="agent-simulator"
            data={undefined}
            id="simulator"
          />
          <AgentPanelSidebarItem
            label={t('nav.archivalMemories')}
            icon={<BrainIcon />}
            templateId="archival-memories"
            data={{}}
            id="archival-memories"
          />
        </SidebarGroup>
        {isTemplate && (
          <SidebarGroup title="Distribute">
            <AgentPanelSidebarItem
              label={t('nav.templateVersionManager')}
              icon={<BoxesIcon />}
              templateId="deployment"
              data={undefined}
              id="deployment"
            />
          </SidebarGroup>
        )}
      </VStack>
    </VStack>
  );
}

export const agentSidebarTemplate = {
  templateId: 'sidebar',
  content: AgentPageSidebar,
  useGetTitle: () => 'Sd',
  noTab: true,
  data: z.undefined(),
} satisfies PanelTemplate<'sidebar'>;

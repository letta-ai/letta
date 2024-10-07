import React, { useEffect, useMemo, useState } from 'react';
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
  ChevronDown,
  ChevronRight,
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

interface ADEFolderSidebarItemProps {
  label: string;
  templateId: PanelRegistryKeys;
  children: React.ReactNode;
}

function ADEFolderSidebarItem(props: ADEFolderSidebarItemProps) {
  const [open, setOpen] = useState(false);

  const { label, templateId, children } = props;

  const { getIsPanelTemplateActive } = usePanelManager();

  const isActive = useMemo(() => {
    return getIsPanelTemplateActive(templateId);
  }, [getIsPanelTemplateActive, templateId]);

  useEffect(() => {
    if (isActive) {
      setOpen(true);
    }
  }, [isActive]);

  return (
    <>
      <MaybeTooltip renderTooltip={false} placement="right" content={label}>
        <HStack fullWidth align="center" paddingX="small">
          <ADESidebarButton
            label={label}
            onClick={() => {
              setOpen(!open);
            }}
            icon={open ? <ChevronDown /> : <ChevronRight />}
          />
        </HStack>
      </MaybeTooltip>
      {open && <div className="ml-3">{children}</div>}
    </>
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
  const { getIsPanelIdExists } = usePanelManager();

  const isActive = useMemo(() => {
    return getIsPanelIdExists(id);
  }, [getIsPanelIdExists, id]);

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
    <ADEFolderSidebarItem
      label={t('nav.memoryBlocks')}
      templateId="edit-memory-block"
    >
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
          id={`memory-blocks-edit-${block.label}`}
        />
      ))}
    </ADEFolderSidebarItem>
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

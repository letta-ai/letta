import { useTranslations } from '@letta-cloud/translations';
import {
  AgentSimulator,
  AdvancedAgentTemplateSettingsPanel,
  useADELayoutConfig,
  useADEState, adeKeyMap
} from '@letta-cloud/ui-ade-components';
import React, { useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import {
  ArchivalMemoriesIcon,
  HStack,
  MemoryBlocksIcon,
  VStack,
  ToolsIcon,
  FolderIcon,
  LettaInvaderOutlineIcon,
  TuneIcon,
} from '@letta-cloud/ui-component-library';
import { NetworkInspector } from '../../NetworkInspector/NetworkInspector';
import { AgentTemplateSettingsPanel } from '../../ade/panels/AgentTemplateSettingsPanel/AgentTemplateSettingsPanel';
import { AgentSettingsPanel } from '../../ade/panels/AgentSettingsPanel/AgentSettingsPanel';
import { ToolsPanel, useToolsPanelTitle } from '../../ade/panels/ToolsPanel/ToolsPanel';
import { DataSourcesPanel } from '../../ade/panels/DataSourcesV2/DataSourcesPanel';
import { AdvancedSettingsPanel } from '../../ade/panels/AdvancedSettingsPanel/AdvancedSettingsPanel';
import { EditMemory, useEditCoreMemoriesTitle } from '../../ade/panels/EditCoreMemoriesPanel/EditCoreMemoriesPanel';
import {
  ArchivalMemoriesPanel,
  useArchivalMemoriesTitle
} from '../../ade/panels/ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import { ADETabGroup } from '../../shared/ADETabGroup/ADETabGroup';
import { useAgentBaseTypeName } from '../../hooks';
import { useDataSourcesTitle } from '../../ade/panels/DataSourcesV2/hooks/useDataSourcesTitle/useDataSourcesTitle';


function useADETitleTranslations() {
  const { capitalized: baseName } = useAgentBaseTypeName();
  const datasourcesTitle = useDataSourcesTitle();
  const toolsTitle = useToolsPanelTitle();
  const editCoreMemoriesTitle = useEditCoreMemoriesTitle();
  const archivalMemoriesTitle = useArchivalMemoriesTitle();

  return {
    baseName,
    datasourcesTitle,
    toolsTitle,
    editCoreMemoriesTitle,
    archivalMemoriesTitle,
  };
}
export function DesktopLayout() {
  const t = useTranslations('ADELayout');
  const {
    datasourcesTitle,
    toolsTitle,
    editCoreMemoriesTitle,
    archivalMemoriesTitle,
  } = useADETitleTranslations();

  const { isTemplate } = useADEState();

  const {
    layoutConfig,
    setLayoutConfig,
    leftPanelToggleId,
    rightPanelToggleId,
  } = useADELayoutConfig();

  const leftSidebarRef = useRef<ImperativePanelHandle>(null);
  const rightSidebarRef = useRef<ImperativePanelHandle>(null);

  const onLayout = useCallback(
    (panelLayout: number[]) => {
      setLayoutConfig({ panelLayout });
    },
    [setLayoutConfig],
  );

  const toggleLeftPanel = useCallback(() => {
    if (!leftSidebarRef.current) {
      return;
    }

    if (leftSidebarRef.current.isCollapsed()) {
      leftSidebarRef.current.expand();

      return;
    }

    leftSidebarRef.current.collapse();
  }, [leftSidebarRef]);

  const toggleRightPanel = useCallback(() => {
    if (!rightSidebarRef.current) {
      return;
    }

    if (rightSidebarRef.current.isCollapsed()) {
      rightSidebarRef.current.expand();

      return;
    }

    rightSidebarRef.current.collapse();
  }, [rightSidebarRef]);

  return (
    <HStack
      className={isTemplate ? 'border-t border-r border-b' : ''}
      border={!isTemplate}
      color="background-grey"
      fullWidth
      fullHeight
    >
      <NetworkInspector />
      <div
        className="w-[1px] h-[1px] opacity-0 fixed bg-transparent top-0 left-0"
        onClick={toggleLeftPanel}
        id={leftPanelToggleId}
      ></div>
      <div
        className="w-[1px] h-[1px] opacity-0 fixed bg-transparent top-0 right-0"
        onClick={toggleRightPanel}
        id={rightPanelToggleId}
      ></div>
      <PanelGroup
        onLayout={onLayout}
        className="h-full"
        direction="horizontal"
        autoSaveId={!layoutConfig ? 'ade' : undefined}
      >
        <Panel
          ref={leftSidebarRef}
          collapsible
          collapsedSize={0}
          defaultSize={
            typeof layoutConfig?.panelLayout[0] === 'number'
              ? layoutConfig?.panelLayout[0] || 0
              : 30
          }
          className="h-full ade-panel"
          minSize={20}
        >
          <VStack gap={false} fullWidth fullHeight>
            <ADETabGroup
              defaultId="settings"
              tabs={[
                ...(isTemplate
                  ? [
                    {
                      hotkey: adeKeyMap.OPEN_AGENT_SETTINGS_PANEL.command,
                      id: 'settings',
                      title: t('agentTemplateSettings'),
                      icon: <LettaInvaderOutlineIcon />,
                      content: <AgentTemplateSettingsPanel />,
                    },
                  ]
                  : [
                    {
                      hotkey: adeKeyMap.OPEN_AGENT_SETTINGS_PANEL.command,
                      id: 'settings',
                      title: t('agentSettings'),
                      icon: <LettaInvaderOutlineIcon />,
                      content: <AgentSettingsPanel />,
                    },
                  ]),
                {
                  hotkey: adeKeyMap.OPEN_TOOLS_PANEL.command,
                  id: 'tools',
                  title: toolsTitle,
                  icon: <ToolsIcon />,
                  content: <ToolsPanel />,
                },
                {
                  hotkey: adeKeyMap.OPEN_DATASOURCES_PANEL.command,
                  id: 'datasources',
                  title: datasourcesTitle,
                  icon: <FolderIcon />,
                  content: <DataSourcesPanel />,
                },
                ...(!isTemplate
                  ? [
                    {
                      hotkey: adeKeyMap.OPEN_ADVANCED_SETTINGS.command,
                      id: 'advanced-settings',
                      title: t('advancedSettings'),
                      icon: <TuneIcon />,
                      content: <AdvancedSettingsPanel />,
                    },
                  ]
                  : [
                    {
                      hotkey: adeKeyMap.OPEN_ADVANCED_SETTINGS.command,
                      id: 'advanced-settings',
                      title: t('advancedSettings'),
                      icon: <TuneIcon />,
                      content: <AdvancedAgentTemplateSettingsPanel />,
                    },
                  ]),

              ]}
            />
          </VStack>
        </Panel>
        <PanelResizeHandle className="min-w-[1px] w-[1px] bg-border" />
        <Panel
          defaultSize={layoutConfig?.panelLayout[1] || 40}
          className="h-full ade-panel"
          minSize={30}
        >
          <AgentSimulator />
        </Panel>
        <PanelResizeHandle className="min-w-[1px] w-[1px] bg-border" />
        <Panel
          ref={rightSidebarRef}
          collapsible
          defaultSize={
            typeof layoutConfig?.panelLayout[2] === 'number'
              ? layoutConfig?.panelLayout[2] || 0
              : 30
          }
          className="h-full ade-panel"
          minSize={20}
        >
          <VStack gap={false} fullWidth fullHeight>
            <ADETabGroup
              tabs={[
                {
                  id: 'core-memories',
                  icon: <MemoryBlocksIcon />,
                  title: editCoreMemoriesTitle,
                  content: <EditMemory />,
                  hotkey: adeKeyMap.OPEN_CORE_MEMORY_PANEL.command,
                },
                {
                  icon: <ArchivalMemoriesIcon />,
                  id: 'archival-memories',
                  title: archivalMemoriesTitle,
                  hotkey: adeKeyMap.OPEN_ARCHIVAL_MEMORY_PANEL.command,
                  content: <ArchivalMemoriesPanel />,
                },
              ]}
            />
          </VStack>
        </Panel>
      </PanelGroup>
    </HStack>
  );
}

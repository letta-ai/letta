import {
  AppsIcon,
  CloseIcon,
  CodeIcon,
  CogIcon,
  ContextWindowIcon,
  DatabaseIcon,
  EditIcon,
  Frame,
  HiddenOnMobile,
  HStack,
  LettaInvaderIcon,
  Logo,
  NiceGridDisplay,
  SettingsApplicationsIcon,
  ToolsIcon,
  Typography,
  VisibleOnMobile,
  VStack,
} from '@letta-cloud/component-library';
import { AgentSettingsPanel } from '../panels/AgentSettingsPanel/AgentSettingsPanel';
import { ADEGroup } from '../shared/ADEGroup/ADEGroup';
import { useTranslations } from '@letta-cloud/translations';
import { useAgentBaseTypeName } from '../hooks';
import {
  ToolsPanel,
  useToolsPanelTitle,
} from '../panels/ToolsPanel/ToolsPanel';
import { AdvancedSettingsPanel } from '../panels/AdvancedSettingsPanel/AdvancedSettingsPanel';
import {
  EditDataSourcesPanel,
  useDataSourcesTitle,
} from '../panels/EditDataSourcesPanel/EditDataSourcesPanel';
import { AgentSimulator } from '../panels/AgentSimulator/AgentSimulator';
import {
  ContextWindowPanel,
  ContextWindowSimulator,
} from '../panels/ContextEditorPanel/ContextEditorPanel';
import { UserProvider } from '../UserContext/UserContext';
import type { UserContextData } from '../UserContext/UserContext';

import {
  EditMemory,
  useEditCoreMemoriesTitle,
} from '../panels/EditCoreMemoriesPanel/EditCoreMemoriesPanel';
import {
  ArchivalMemoriesPanel,
  useArchivalMemoriesTitle,
} from '../panels/ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import React, { useMemo, useState } from 'react';

interface ADELayoutProps {
  user?: UserContextData['user'];
}

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
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useFeatureFlag } from '@letta-cloud/web-api-client';
import { Slot } from '@radix-ui/react-slot';
import { createPortal } from 'react-dom';

function DesktopLayout() {
  const t = useTranslations('ADELayout');
  const {
    baseName,
    datasourcesTitle,
    toolsTitle,
    editCoreMemoriesTitle,
    archivalMemoriesTitle,
  } = useADETitleTranslations();

  const { data: isContextWindowSimulatorEnabled } = useFeatureFlag(
    'CONTEXT_WINDOW_SIMULATOR',
  );

  return (
    <HStack gap="small" fullWidth fullHeight>
      <PanelGroup className="h-full" direction="horizontal" autoSaveId="ade">
        <Panel
          defaultSize={30}
          defaultValue={30}
          className="h-full"
          minSize={20}
        >
          <VStack gap="small" fullWidth fullHeight>
            <ADEGroup
              items={[
                {
                  title: t('settings', { baseName }),
                  id: 'settings',
                  content: <AgentSettingsPanel />,
                },
                {
                  title: t('advancedSettings'),
                  id: 'advanced-settings',
                  content: <AdvancedSettingsPanel />,
                },
              ]}
            />
            <ADEGroup
              items={[
                {
                  title: toolsTitle,
                  id: 'tools',
                  content: <ToolsPanel />,
                },
                {
                  title: datasourcesTitle,
                  id: 'datasources',
                  content: <EditDataSourcesPanel />,
                },
              ]}
            />
          </VStack>
        </Panel>
        <PanelResizeHandle className="w-[4px]" />
        <Panel
          defaultSize={40}
          defaultValue={40}
          className="h-full"
          minSize={30}
        >
          <HStack fullWidth fullHeight>
            <ADEGroup
              items={[
                {
                  title: t('agentSimulator'),
                  id: 'agent-simulator',
                  content: <AgentSimulator />,
                },
                ...(isContextWindowSimulatorEnabled
                  ? [
                      {
                        title: t('contextWindowSimulator'),
                        id: 'context-window-simulator',
                        content: <ContextWindowSimulator />,
                      },
                    ]
                  : []),
              ]}
            />
          </HStack>
        </Panel>
        <PanelResizeHandle className="w-[4px]" />
        <Panel
          defaultSize={30}
          defaultValue={30}
          className="h-full"
          minSize={20}
        >
          <VStack gap="small" fullWidth fullHeight>
            <HStack className="max-h-[100px]">
              <ContextWindowPanel />
            </HStack>
            <ADEGroup
              items={[
                {
                  title: editCoreMemoriesTitle,
                  id: 'core-memories',
                  content: <EditMemory />,
                },
              ]}
            />
            <ADEGroup
              items={[
                {
                  title: archivalMemoriesTitle,
                  id: 'archival-memories',
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

interface AppPanel {
  title: string;
  mobileTitle: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

function useAppPanels(): Record<string, AppPanel> {
  const {
    baseName,
    datasourcesTitle,
    toolsTitle,
    editCoreMemoriesTitle,
    archivalMemoriesTitle,
  } = useADETitleTranslations();

  const t = useTranslations('ADELayout');
  return useMemo(
    () => ({
      settings: {
        title: t('settings', { baseName }),
        mobileTitle: t('mobileTitles.settings'),
        icon: <SettingsApplicationsIcon />,
        content: <AgentSettingsPanel />,
      },
      advancedSettings: {
        title: t('advancedSettings'),
        mobileTitle: t('mobileTitles.advancedSettings'),
        icon: <CogIcon />,
        content: <AdvancedSettingsPanel />,
      },
      tools: {
        title: toolsTitle,
        mobileTitle: t('mobileTitles.tools'),
        icon: <ToolsIcon />,
        content: <ToolsPanel />,
      },
      datasources: {
        title: datasourcesTitle,
        mobileTitle: t('mobileTitles.datasources'),
        icon: <DatabaseIcon />,
        content: <EditDataSourcesPanel />,
      },
      agentSimulator: {
        title: t('agentSimulator'),
        mobileTitle: t('mobileTitles.agentSimulator'),
        icon: <LettaInvaderIcon />,
        content: <AgentSimulator />,
      },
      contextWindow: {
        title: t('contextWindow'),
        mobileTitle: t('mobileTitles.contextWindow'),
        icon: <ContextWindowIcon />,
        content: <ContextWindowPanel />,
      },
      coreMemories: {
        title: editCoreMemoriesTitle,
        mobileTitle: t('mobileTitles.coreMemories'),
        icon: <CodeIcon />,
        content: <EditMemory />,
      },
      archivalMemories: {
        title: archivalMemoriesTitle,
        mobileTitle: t('mobileTitles.archivalMemories'),
        icon: <EditIcon />,
        content: <ArchivalMemoriesPanel />,
      },
    }),
    [
      t,
      baseName,
      datasourcesTitle,
      toolsTitle,
      editCoreMemoriesTitle,
      archivalMemoriesTitle,
    ],
  );
}

interface MobileAppSelectorProps {
  selectedAppId: string;
  setSelectedAppId: (appId: string) => void;
  onClose: VoidFunction;
}

function MobileAppSelector(props: MobileAppSelectorProps) {
  const { onClose, selectedAppId, setSelectedAppId } = props;

  const t = useTranslations('ADELayout');
  const appPanels = useAppPanels();

  return createPortal(
    <div
      className="
    bg-background
    overflow-hidden
    w-dvw
    h-dvh
    fade-in-0 animate-in
    p-2
    fixed top-0 left-0 z-miniapp"
    >
      <VStack
        border
        gap="large"
        overflow="hidden"
        align="center"
        justify="center"
        fullWidth
        fullHeight
      >
        <VStack paddingX overflowY="auto" justify="center" fullHeight fullWidth>
          <NiceGridDisplay itemWidth="100px" itemHeight="100px">
            {Object.entries(appPanels).map(([appId, appPanel]) => (
              <VStack
                fullHeight
                fullWidth
                align="center"
                justify="center"
                color={selectedAppId === appId ? 'primary' : 'background'}
                key={appId}
                onClick={() => {
                  onClose();
                  setSelectedAppId(appId);
                }}
              >
                <Slot className="w-8 h-8">{appPanel.icon}</Slot>
                <Typography>{appPanel.mobileTitle}</Typography>
              </VStack>
            ))}
          </NiceGridDisplay>
        </VStack>
        <HStack
          onClick={() => {
            onClose();
          }}
          as="button"
          height="header-sm"
          align="center"
          borderTop
          padding="small"
          fullWidth
          justify="spaceBetween"
        >
          <HStack align="center">
            <AppsIcon />
            <Typography className="mt-0.5">
              {t('MobileAppSelector.apps')}
            </Typography>
          </HStack>
          <div className="sr-only">{t('MobileAppSelector.close')}</div>
          <CloseIcon />
        </HStack>
      </VStack>
    </div>,
    document.body,
  );
}

function MobileLayout() {
  const [selectedAppId, setSelectedAppId] = useState('agentSimulator');
  const [isMobileAppSelectorOpen, setIsMobileAppSelectorOpen] = useState(false);
  const appPanels = useAppPanels();
  const selectedApp = appPanels[selectedAppId];
  const t = useTranslations('ADELayout');

  return (
    <VStack gap={false} fullWidth fullHeight overflow="hidden">
      <VStack
        gap={false}
        overflow="hidden"
        fullWidth
        border
        flex
        collapseHeight
      >
        <VStack fullWidth flex collapseHeight>
          {selectedApp.content}
        </VStack>
        <HStack
          as="button"
          onClick={() => {
            setIsMobileAppSelectorOpen(true);
          }}
          fullWidth
          justify="spaceBetween"
          borderTop
          height="header-sm"
          padding="small"
          align="center"
        >
          <HStack align="center">
            <Slot className="w-5 h-5">{selectedApp.icon}</Slot>
            <Typography>{selectedApp.title}</Typography>
          </HStack>
          <div className={'sr-only'}>{t('MobileAppSelector.open')}</div>
          <AppsIcon />
        </HStack>
      </VStack>
      {isMobileAppSelectorOpen && (
        <MobileAppSelector
          onClose={() => {
            setIsMobileAppSelectorOpen(false);
          }}
          selectedAppId={selectedAppId}
          setSelectedAppId={setSelectedAppId}
        />
      )}
    </VStack>
  );
}

export function ADELayout(props: ADELayoutProps) {
  const { user } = props;

  return (
    <UserProvider user={user}>
      <Frame position="relative" fullWidth fullHeight zIndex="rightAboveZero">
        <HiddenOnMobile checkWithJs>
          <DesktopLayout />
        </HiddenOnMobile>
        <VisibleOnMobile checkWithJs>
          <MobileLayout />
        </VisibleOnMobile>
      </Frame>
      <VStack
        className="top-0 left-0 fixed z-[-1]"
        position="fixed"
        fullHeight
        fullWidth
        align="center"
        justify="center"
      >
        <Logo size="large" color="steel" />
      </VStack>
    </UserProvider>
  );
}

import {
  ChevronDownIcon,
  ChevronUpIcon,
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
  MobileFooterNavigation,
  MobileFooterNavigationButton,
  SettingsApplicationsIcon,
  ToolsIcon,
  VisibleOnMobile,
  VStack,
} from '@letta-web/component-library';
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
import { ContextWindowPanel } from '../panels/ContextEditorPanel/ContextEditorPanel';
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

function DesktopLayout() {
  const t = useTranslations('ADELayout');
  const {
    baseName,
    datasourcesTitle,
    toolsTitle,
    editCoreMemoriesTitle,
    archivalMemoriesTitle,
  } = useADETitleTranslations();

  return (
    <HStack gap="small" fullWidth fullHeight>
      <VStack className="min-w-[250px] w-full">
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
      <HStack className="w-full min-w-[300px]">
        <ADEGroup
          items={[
            {
              title: t('agentSimulator'),
              id: 'agent-simulator',
              content: <AgentSimulator />,
            },
          ]}
        />
      </HStack>
      <VStack className="min-w-[250px] w-full">
        <HStack className="max-h-[100px]">
          <ADEGroup
            items={[
              {
                title: t('contextWindow'),
                id: 'content-window',
                content: <ContextWindowPanel />,
              },
            ]}
          />
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
    </HStack>
  );
}

interface AppPanel {
  title: string;
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
        icon: <SettingsApplicationsIcon />,
        content: <AgentSettingsPanel />,
      },
      advancedSettings: {
        title: t('advancedSettings'),
        icon: <CogIcon />,
        content: <AdvancedSettingsPanel />,
      },
      tools: {
        title: toolsTitle,
        icon: <ToolsIcon />,
        content: <ToolsPanel />,
      },
      datasources: {
        title: datasourcesTitle,
        icon: <DatabaseIcon />,
        content: <EditDataSourcesPanel />,
      },
      agentSimulator: {
        title: t('agentSimulator'),
        icon: <LettaInvaderIcon />,
        content: <AgentSimulator />,
      },
      contextWindow: {
        title: t('contextWindow'),
        icon: <ContextWindowIcon />,
        content: <ContextWindowPanel />,
      },
      coreMemories: {
        title: editCoreMemoriesTitle,
        icon: <CodeIcon />,
        content: <EditMemory />,
      },
      archivalMemories: {
        title: archivalMemoriesTitle,
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

interface AgentMobileNavigationProps {
  activePanel?: string;
  setActivePanel?: (panelId: string) => void;
}

const MORE_PANELS = 'more-panels';

function AgentMobileNavigation(props: AgentMobileNavigationProps) {
  const { activePanel, setActivePanel } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const [expanded, setExpanded] = useState(false);
  const appPanels = useAppPanels();

  const panelToShowInMainNavigation = useMemo(() => {
    const firstElements = ['agentSimulator', 'settings'];

    const activePanelIsFirstElement = firstElements.includes(activePanel || '');

    const defaultPanelIdsToShow = [
      ...firstElements,
      !activePanelIsFirstElement ? activePanel : 'coreMemories',
      MORE_PANELS,
      'coreMemories',
      'tools',
      'datasources',
      'advancedSettings',
      'archivalMemories',
    ];

    const list = Array.from(new Set(defaultPanelIdsToShow));

    if (expanded) {
      return list;
    }

    return list.slice(0, 4);
  }, [activePanel, expanded]);

  return (
    <MobileFooterNavigation>
      {panelToShowInMainNavigation.map((panelId) => {
        if (panelId === MORE_PANELS) {
          return (
            <MobileFooterNavigationButton
              onClick={() => {
                setExpanded((prev) => !prev);
              }}
              id="open-more-panels"
              key={MORE_PANELS}
              size="large"
              preIcon={!expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              color="tertiary-transparent"
              label={
                !expanded
                  ? t('AgentMobileNavigation.more')
                  : t('AgentMobileNavigation.less')
              }
            />
          );
        }

        if (!panelId) {
          return null;
        }

        return (
          <MobileFooterNavigationButton
            active={panelId === activePanel}
            id={panelId}
            key={panelId}
            size="large"
            onClick={() => {
              setActivePanel?.(panelId);
              setExpanded(false);
            }}
            preIcon={appPanels[panelId].icon}
            label={appPanels[panelId].title}
          />
        );
      })}
    </MobileFooterNavigation>
  );
}

function MobileLayout() {
  const [selectedAppId, setSelectedAppId] = useState('agentSimulator');

  const appPanels = useAppPanels();
  const selectedApp = appPanels[selectedAppId];

  return (
    <VStack fullWidth fullHeight>
      <VStack fullWidth fullHeight>
        <ADEGroup
          items={[
            {
              title: selectedApp.title,
              id: 'selected',
              content: selectedApp.content,
            },
          ]}
        />
      </VStack>
      <AgentMobileNavigation
        activePanel={selectedAppId}
        setActivePanel={setSelectedAppId}
      />
    </VStack>
  );
}

export function ADELayout(props: ADELayoutProps) {
  const { user } = props;

  return (
    <UserProvider user={user}>
      <Frame position="relative" fullWidth fullHeight zIndex="rightAboveZero">
        <VisibleOnMobile checkWithJs>
          <MobileLayout />
        </VisibleOnMobile>
        <HiddenOnMobile checkWithJs>
          <DesktopLayout />
        </HiddenOnMobile>
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

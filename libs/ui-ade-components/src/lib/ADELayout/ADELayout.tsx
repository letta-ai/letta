'use client';
import {
  AppsIcon,
  Button,
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
  OnboardingPrimaryDialog,
  OnboardingPrimaryHeading,
  OnboardingSteps,
  SettingsApplicationsIcon,
  ToolsIcon,
  Typography,
  VisibleOnMobile,
  VStack,
} from '@letta-cloud/ui-component-library';
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
import { AppContextProvider } from '../AppContext/AppContext';
import type { UserContextData } from '../AppContext/AppContext';

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
  projectId?: string;
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
import { Slot } from '@radix-ui/react-slot';
import { createPortal } from 'react-dom';
import { useADETour } from '../hooks/useADETour/useADETour';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';
import { usePauseOnboarding } from '@letta-cloud/sdk-web';

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
    <HStack border color="background-grey" fullWidth fullHeight>
      <PanelGroup className="h-full" direction="horizontal" autoSaveId="ade">
        <Panel
          defaultSize={30}
          defaultValue={30}
          className="h-full"
          minSize={20}
        >
          <VStack gap={false} fullWidth fullHeight>
            <div className="h-[380px]">
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
            </div>
            <div className="h-[1px] w-full bg-border" />
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
        <PanelResizeHandle className="w-[1px] bg-border" />
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
                {
                  title: t('contextWindowSimulator'),
                  id: 'context-window-simulator',
                  content: <ContextWindowSimulator />,
                },
              ]}
            />
          </HStack>
        </Panel>
        <PanelResizeHandle className="w-[1px] bg-border" />
        <Panel
          defaultSize={30}
          defaultValue={30}
          className="h-full"
          minSize={20}
        >
          <VStack gap={false} fullWidth fullHeight>
            <HStack className="max-h-[100px]">
              <ContextWindowPanel />
            </HStack>
            <div className="h-[1px] w-full bg-border" />
            <ADEGroup
              items={[
                {
                  title: editCoreMemoriesTitle,
                  id: 'core-memories',
                  content: <EditMemory />,
                },
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
                className="min-h-[100px]"
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
          color="background-grey"
          onClick={() => {
            onClose();
          }}
          as="button"
          align="center"
          padding
          className="min-h-[56px] mb-[-7px]"
          fullWidth
          justify="spaceBetween"
        >
          <HStack align="center">
            <AppsIcon />
            <Typography bold className="mt-0.5">
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
      <VStack gap={false} overflow="hidden" fullWidth flex collapseHeight>
        <VStack border fullWidth flex color="background-grey" collapseHeight>
          {selectedApp.content}
        </VStack>
        <HStack
          as="button"
          onClick={() => {
            setIsMobileAppSelectorOpen(true);
          }}
          fullWidth
          justify="spaceBetween"
          className="min-h-[56px] mb-[-7px]"
          padding
          align="center"
        >
          <HStack align="center">
            <Slot className="w-5 h-5">{selectedApp.icon}</Slot>
            <Typography bold>{selectedApp.title}</Typography>
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

function ADEOnboarding() {
  const t = useTranslations('ADELayout');

  const { currentStep, setStep } = useADETour();
  const { pauseOnboarding } = usePauseOnboarding();

  if (currentStep !== 'welcome') {
    return null;
  }

  return (
    <OnboardingPrimaryDialog
      isOpen
      imageUrl="/images/ade-onboarding/welcome.svg"
      title={t('ADEOnboarding.welcome')}
      primaryAction={
        <Button
          onClick={() => {
            setStep('core_memories');
          }}
          label={t('ADEOnboarding.start')}
          color="primary"
        />
      }
      secondaryAction={
        <Button
          onClick={pauseOnboarding}
          label={t('ADEOnboarding.skip')}
          color="tertiary"
        />
      }
    >
      <VStack>
        <OnboardingPrimaryHeading
          title={t('ADEOnboarding.welcome')}
          description={t('ADEOnboarding.description')}
        ></OnboardingPrimaryHeading>
        <OnboardingSteps
          currentStep={3}
          totalSteps={TOTAL_PRIMARY_ONBOARDING_STEPS}
        />
      </VStack>
    </OnboardingPrimaryDialog>
  );
}

export function ADELayout(props: ADELayoutProps) {
  const { user, projectId } = props;

  return (
    <AppContextProvider user={user} projectId={projectId}>
      <Frame
        overflow="hidden"
        position="relative"
        fullWidth
        fullHeight
        zIndex="rightAboveZero"
      >
        <HiddenOnMobile checkWithJs>
          <ADEOnboarding />
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
    </AppContextProvider>
  );
}

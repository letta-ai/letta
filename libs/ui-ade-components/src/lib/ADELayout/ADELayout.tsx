'use client';
import {
  AppsIcon,
  Button,
  CloseIcon,
  CodeIcon,
  CogIcon,
  ConfirmPauseOnboardingDialog,
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
import {
  AgentSettingsOnboarding,
  AgentSettingsPanel,
} from '../panels/AgentSettingsPanel/AgentSettingsPanel';
import { useTranslations } from '@letta-cloud/translations';
import { useAgentBaseTypeName, useCurrentAgentMetaData } from '../hooks';
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
import React, { useCallback, useMemo, useRef, useState } from 'react';
import WelcomeWebp from './welcome-to-ade.webp';

import type { ImperativePanelHandle } from 'react-resizable-panels';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Slot } from '@radix-ui/react-slot';
import { createPortal } from 'react-dom';
import { useADETour } from '../hooks/useADETour/useADETour';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';
import { NetworkInspector } from '../NetworkInspector/NetworkInspector';
import { useGlobalNetworkInterceptor } from '../hooks';
import {
  useSetOnboardingStep,
  useUnpauseOnboarding,
} from '@letta-cloud/sdk-web';
import { DataSourcesPanel } from '../panels/DataSourcesV2/DataSourcesPanel';
import { LLMConfigPanel } from '../panels/LLMConfigPanel/LLMConfigPanel';
import { EmbeddingConfigPanel } from '../panels/EmbeddingConfigPanel/EmbeddingConfigPanel';
import { MetadataPanel } from '../panels/MetadataPanel/MetadataPanel';
import { useQuickADETour } from '../hooks/useQuickADETour/useQuickADETour';
import { useRouter } from 'next/navigation';
import { ADEAccordionGroup } from '../shared/ADEAccordionGroup/ADEAccordionGroup';
import { useADELayoutConfig } from '../hooks/useADELayoutConfig/useADELayoutConfig';
import { SimulatedAgentProvider } from '../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';

interface ADELayoutProps {
  user?: UserContextData['user'];
  projectId?: string;
  projectSlug?: string;
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

  const { isTemplate } = useCurrentAgentMetaData();

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
            <ADEAccordionGroup
              panels={[
                {
                  WrapperComponent: AgentSettingsOnboarding,
                  id: 'settings',
                  label: t('settings', { baseName }),
                  content: <AgentSettingsPanel />,
                  minHeight: 150,
                },
                {
                  id: 'tools',
                  label: toolsTitle,
                  content: <ToolsPanel />,
                  minHeight: 200,
                },
                {
                  id: 'datasources',
                  label: datasourcesTitle,
                  minHeight: 200,
                  content: <DataSourcesPanel />,
                },
                {
                  id: 'metadata',
                  label: 'Metadata',
                  content: <MetadataPanel />,
                  minHeight: 150,
                  defaultOpen: false,
                },
                {
                  id: 'llm-config',
                  label: 'LLM Config',
                  content: <LLMConfigPanel />,
                  minHeight: 150,
                  defaultOpen: false,
                },
                {
                  id: 'embedding-config',
                  label: 'Embedding Config',
                  content: <EmbeddingConfigPanel />,
                  minHeight: 200,
                  defaultOpen: false,
                },
                {
                  id: 'advanced-settings',
                  label: t('advancedSettings'),
                  content: <AdvancedSettingsPanel />,
                  minHeight: 100,
                  defaultOpen: false,
                },
              ]}
            />
          </VStack>
        </Panel>
        <PanelResizeHandle className="w-[1px]" />
        <Panel
          defaultSize={layoutConfig?.panelLayout[1] || 40}
          className="h-full ade-panel"
          minSize={30}
        >
          <AgentSimulator />
        </Panel>
        <PanelResizeHandle className="w-[1px] bg-border" />
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
            <ADEAccordionGroup
              panels={[
                {
                  id: 'context-window',
                  label: t('contextWindow'),
                  content: <ContextWindowPanel />,
                },
                {
                  id: 'core-memories',
                  label: editCoreMemoriesTitle,
                  content: <EditMemory />,
                  minHeight: 300,
                },
                {
                  id: 'archival-memories',
                  label: archivalMemoriesTitle,
                  content: <ArchivalMemoriesPanel />,
                  minHeight: 300,
                  defaultOpen: false,
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

function QuickADEOnboarding() {
  const t = useTranslations('ADELayout.QuickADEOnboarding');
  const { unpauseOnboarding } = useUnpauseOnboarding();

  const { setOnboardingStep, isPending, isSuccess } = useSetOnboardingStep();
  const { push } = useRouter();
  const { currentStep, setStep, resetTour } = useQuickADETour();

  const handleStart = useCallback(() => {
    setOnboardingStep({
      onboardingStep: 'about_credits',
      onSuccess: () => {
        unpauseOnboarding();
        resetTour();
        push('/models');
      },
    });
  }, [unpauseOnboarding, setOnboardingStep, resetTour, push]);

  if (currentStep === 'welcome') {
    return (
      <OnboardingPrimaryDialog
        isOpen
        imageUrl={WelcomeWebp}
        title={t('welcome')}
        primaryAction={
          <Button
            onClick={() => {
              setStep('message');
            }}
            label={t('continue')}
            color="primary"
          />
        }
      >
        <VStack>
          <OnboardingPrimaryHeading
            title={t('welcome')}
            description={t('description')}
          ></OnboardingPrimaryHeading>
        </VStack>
      </OnboardingPrimaryDialog>
    );
  }

  if (currentStep === 'done') {
    return (
      <OnboardingPrimaryDialog
        isOpen
        imageUrl={WelcomeWebp}
        title={t('done.label')}
        primaryAction={
          <Button
            onClick={() => {
              resetTour();
            }}
            disabled={isPending || isSuccess}
            label={t('complete')}
            color="primary"
          />
        }
      >
        <VStack>
          <OnboardingPrimaryHeading
            title={t('done.label')}
          ></OnboardingPrimaryHeading>
          <VStack gap="xlarge">
            <VStack>
              <Typography variant="large">{t('done.part1')}</Typography>
              <HStack>
                <Button
                  target="_blank"
                  href="https://docs.letta.com"
                  label={t('done.part2')}
                  color="secondary"
                />
              </HStack>
            </VStack>
            <VStack>
              <Typography variant="large">{t('done.part3')}</Typography>
              <HStack>
                <Button
                  onClick={handleStart}
                  label={t('done.part4')}
                  color="secondary"
                  busy={isPending || isSuccess}
                />
              </HStack>
            </VStack>
          </VStack>
        </VStack>
      </OnboardingPrimaryDialog>
    );
  }

  return null;
}

function ADEOnboarding() {
  const t = useTranslations('ADELayout');

  const { currentStep, setStep } = useADETour();

  if (currentStep !== 'welcome') {
    return null;
  }

  return (
    <OnboardingPrimaryDialog
      isOpen
      imageUrl={WelcomeWebp}
      title={t('ADEOnboarding.welcome')}
      primaryAction={
        <Button
          onClick={() => {
            setStep('template');
          }}
          label={t('ADEOnboarding.start')}
          color="primary"
        />
      }
      secondaryAction={
        <ConfirmPauseOnboardingDialog
          trigger={<Button label={t('ADEOnboarding.skip')} color="tertiary" />}
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
  const { user, projectId, projectSlug } = props;

  useGlobalNetworkInterceptor();

  return (
    <AppContextProvider
      projectSlug={projectSlug}
      user={user}
      projectId={projectId}
    >
      <SimulatedAgentProvider>
        <Frame
          overflow="hidden"
          position="relative"
          fullWidth
          fullHeight
          zIndex="rightAboveZero"
        >
          <HiddenOnMobile checkWithJs>
            <QuickADEOnboarding />
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
      </SimulatedAgentProvider>
    </AppContextProvider>
  );
}

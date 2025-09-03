'use client';
import {
  Button,
  ChevronDownIcon,
  CodeIcon,
  CogIcon,
  ContextWindowIcon,
  EditIcon,
  Frame,
  HiddenOnMobile,
  HStack,
  LettaInvaderIcon,
  Logo,
  OnboardingPrimaryDialog,
  OnboardingPrimaryHeading,
  OnboardingSteps,
  SettingsApplicationsIcon,
  TemplateIcon,
  ToolsIcon,
  Typography,
  VisibleOnMobile,
  VStack,
  Popover,
} from '@letta-cloud/ui-component-library';
import {
  AgentSettingsOnboarding,
  AgentSettingsPanel,
} from '../ade/panels/AgentSettingsPanel/AgentSettingsPanel';
import { useTranslations } from '@letta-cloud/translations';
import { useAgentBaseTypeName } from '../hooks';
import {
  ToolsPanel,
  useToolsPanelTitle,
} from '../ade/panels/ToolsPanel/ToolsPanel';
import { AdvancedSettingsPanel } from '../ade/panels/AdvancedSettingsPanel/AdvancedSettingsPanel';
import { AgentSimulator } from '../ade/panels/AgentSimulator/AgentSimulator';
import { ContextWindowPanel } from '../ade/panels/ContextEditorPanel/ContextEditorPanel';

import {
  EditMemory,
  useEditCoreMemoriesTitle,
} from '../ade/panels/EditCoreMemoriesPanel/EditCoreMemoriesPanel';
import {
  ArchivalMemoriesPanel,
  useArchivalMemoriesTitle,
} from '../ade/panels/ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import WelcomeWebp from './welcome-to-ade.webp';

import type { ImperativePanelHandle } from 'react-resizable-panels';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useADETour } from '../hooks/useADETour/useADETour';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';
import { NetworkInspector } from '../NetworkInspector/NetworkInspector';
import {
  useGlobalNetworkInterceptor,
} from '../hooks';
import { DataSourcesPanel } from '../ade/panels/DataSourcesV2/DataSourcesPanel';
import { LLMConfigPanel } from '../ade/panels/LLMConfigPanel/LLMConfigPanel';
import { EmbeddingConfigPanel } from '../ade/panels/EmbeddingConfigPanel/EmbeddingConfigPanel';
import { MetadataPanel } from '../ade/panels/MetadataPanel/MetadataPanel';
import { useQuickADETour } from '../hooks/useQuickADETour/useQuickADETour';
import { ADEAccordionGroup } from '../shared/ADEAccordionGroup/ADEAccordionGroup';
import { useADELayoutConfig } from '../hooks/useADELayoutConfig/useADELayoutConfig';
import { SimulatedAgentProvider } from '../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { ConfirmPauseOnboardingDialog } from '../OnboardingAsideFocus/ConfirmPauseOnboardingDialog/ConfirmPauseOnboardingDialog';
import { ToolManagerProvider } from '../ade/panels/ToolManager/hooks/useToolManagerState/useToolManagerState';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useADEState } from '../hooks/useADEState/useADEState';
import { useDataSourcesTitle } from '../ade/panels/DataSourcesV2/hooks/useDataSourcesTitle/useDataSourcesTitle';

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
      toolsTitle,
      editCoreMemoriesTitle,
      archivalMemoriesTitle,
    ],
  );
}

interface MobileAppPopoverOption {
  value: string;
  label: string;
  icon: React.ReactNode;
}

interface MobileAppPopoverNavProps {
  options: MobileAppPopoverOption[];
  selectedOption: MobileAppPopoverOption | undefined;
  onSelect: (option: MobileAppPopoverOption) => void;
}

function MobileAppPopoverNav({
  options,
  selectedOption,
  onSelect,
}: MobileAppPopoverNavProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('ADELayout.MobileAppSelector');
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      triggerAsChild
      trigger={
        <Button
          fullWidth
          color="grey2"
          preIcon={selectedOption?.icon}
          postIcon={<ChevronDownIcon />}
          label={selectedOption?.label || t('apps')}
          align="left"
          _use_rarely_className="border border-border"
        />
      }
      align="center"
      side="bottom"
      offset={4}
    >
      <VStack gap={false}>
        {options.map((option) => (
          <Button
            key={option.value}
            color={
              option.value === selectedOption?.value ? 'brand' : 'secondary'
            }
            preIcon={option.icon}
            label={option.label}
            fullWidth
            onClick={() => {
              onSelect(option);
              setOpen(false);
            }}
            align="left"
            _use_rarely_className="border-none font-normal"
          />
        ))}
      </VStack>
    </Popover>
  );
}

function MobileLayout() {
  const [selectedAppId, setSelectedAppId] = useState('agentSimulator');
  const appPanels = useAppPanels();
  const selectedApp = appPanels[selectedAppId];

  const options = useMemo(
    () =>
      Object.entries(appPanels).map(([appId, appPanel]) => ({
        value: appId,
        label: appPanel.mobileTitle,
        icon: appPanel.icon,
      })),
    [appPanels],
  );

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedAppId),
    [options, selectedAppId],
  );

  return (
    <VStack gap={false} fullWidth fullHeight overflow="hidden">
      <MobileAppPopoverNav
        options={options}
        selectedOption={selectedOption}
        onSelect={(option) => {
          if (
            option &&
            !Array.isArray(option) &&
            'value' in option &&
            option.value
          ) {
            setSelectedAppId(option.value);
          }
        }}
      />
      <VStack gap={false} overflow="hidden" fullWidth flex collapseHeight>
        <VStack border fullWidth flex color="background-grey" collapseHeight>
          {selectedApp.content}
        </VStack>
      </VStack>
    </VStack>
  );
}

function QuickADEOnboarding() {
  const t = useTranslations('ADELayout.QuickADEOnboarding');
  const { currentStep, resetTour } = useQuickADETour();

  if (currentStep === 'done') {
    return (
      <OnboardingPrimaryDialog
        isOpen
        imageUrl={WelcomeWebp}
        title={t('done.label')}
        primaryAction={
          <Button
            onClick={() => {
              trackClientSideEvent(AnalyticsEvent.USER_ONBOARDING_COMPLETED, {
                onboarding_type: 'create:new_agent',
                onboarding_step: 'finish_tour',
              });
              resetTour();
            }}
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
            <VStack fullWidth>
              <Typography variant="large">{t('done.part1')}</Typography>
              <Typography variant="large">{t('done.part2')}</Typography>
              <HStack fullWidth paddingY="small">
                <VStack fullWidth>
                  <Button
                    fullWidth
                    align="left"
                    preIcon={<TemplateIcon />}
                    target="_blank"
                    href="https://docs.letta.com/guides/templates/overview"
                    label={t('done.versioningTemplates')}
                    color="tertiary"
                    onClick={() => {
                      trackClientSideEvent(
                        AnalyticsEvent.USER_ONBOARDING_RESOURCE_CLICKED,
                        {
                          onboarding_type: 'create:new_agent',
                          resource_name: 'versioning_templates',
                        },
                      );
                    }}
                  />
                  <Button
                    fullWidth
                    align="left"
                    preIcon={<CodeIcon />}
                    target="_blank"
                    href="https://docs.letta.com/quickstart"
                    label={t('done.sdkQuickstart')}
                    color="tertiary"
                    onClick={() => {
                      trackClientSideEvent(
                        AnalyticsEvent.USER_ONBOARDING_RESOURCE_CLICKED,
                        {
                          onboarding_type: 'create:new_agent',
                          resource_name: 'sdk_quickstart',
                        },
                      );
                    }}
                  />
                </VStack>
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

export function ADELayout() {
  useGlobalNetworkInterceptor();

  return (
    <SimulatedAgentProvider>
      <ToolManagerProvider>
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
      </ToolManagerProvider>
    </SimulatedAgentProvider>
  );
}

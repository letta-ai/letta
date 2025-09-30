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
  SettingsApplicationsIcon,
  TemplateIcon,
  ToolsIcon,
  Typography,
  VisibleOnMobile,
  VStack,
  Popover,
} from '@letta-cloud/ui-component-library';
import { AgentSettingsPanel } from '../ade/panels/AgentSettingsPanel/AgentSettingsPanel';
import { useTranslations } from '@letta-cloud/translations';
import {
  ToolsPanel, useToolsPanelTitle
} from '../ade/panels/ToolsPanel/ToolsPanel';
import { AdvancedSettingsPanel } from '../ade/panels/AdvancedSettingsPanel/AdvancedSettingsPanel';
import { AgentSimulator } from '../ade/panels/AgentSimulator/AgentSimulator';
import { ContextWindowPanel } from '../ade/panels/ContextEditorPanel/ContextEditorPanel';

import {
  EditMemory, useEditCoreMemoriesTitle
} from '../ade/panels/EditCoreMemoriesPanel/EditCoreMemoriesPanel';
import {
  ArchivalMemoriesPanel, useArchivalMemoriesTitle
} from '../ade/panels/ArchivalMemoriesPanel/ArchivalMemoriesPanel';
import React, { useMemo, useState } from 'react';
import WelcomeWebp from './welcome-to-ade.webp';
import { NetworkInspector } from '../NetworkInspector/NetworkInspector';
import { useAgentBaseTypeName, useGlobalNetworkInterceptor } from '../hooks';
import { useQuickADETour } from '../hooks/useQuickADETour/useQuickADETour';
import { SimulatedAgentProvider } from '../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { ToolManagerProvider } from '../ade/panels/ToolManager/hooks/useToolManagerState/useToolManagerState';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useADEState } from '../hooks/useADEState/useADEState';
import { AgentTemplateSettingsPanel } from '../ade/panels/AgentTemplateSettingsPanel/AgentTemplateSettingsPanel';
import { DesktopLayout } from './DesktopLayout/DesktopLayout';
import { useDataSourcesTitle } from '../ade/panels/DataSourcesV2/hooks/useDataSourcesTitle/useDataSourcesTitle';

interface AppPanel {
  title: string;
  mobileTitle: string;
  icon: React.ReactNode;
  content: React.ReactNode;
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

function useAppPanels(): Record<string, AppPanel> {
  const { baseName, toolsTitle, editCoreMemoriesTitle, archivalMemoriesTitle } =
    useADETitleTranslations();

  const { isTemplate } = useADEState();

  const t = useTranslations('ADELayout');
  return useMemo(
    () => ({
      settings: {
        title: t('settings', { baseName }),
        mobileTitle: t('mobileTitles.settings'),
        icon: <SettingsApplicationsIcon />,
        content: isTemplate ? (
          <AgentTemplateSettingsPanel />
        ) : (
          <AgentSettingsPanel />
        ),
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
      isTemplate,
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
          <NetworkInspector />
          <HiddenOnMobile checkWithJs>
            <QuickADEOnboarding />
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

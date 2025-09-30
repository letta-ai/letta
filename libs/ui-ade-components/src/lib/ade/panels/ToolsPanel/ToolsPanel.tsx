'use client';
import React, { useState } from 'react';
import {
  HStack,
  RuleIcon,
  SearchIcon,
  ToolManagerIcon,
  Tooltip,
  Typography,
  VariableIcon,
  WarningIcon
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '../../../OnboardingAsideFocus/OnboardingAsideFocus';
import { SearchOverlay } from '../../../shared/SearchOverlay';

import { VStack } from '@letta-cloud/ui-component-library';
import { Button, PanelMainContent } from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../../hooks';

import { useTranslations } from '@letta-cloud/translations';
import { ToolManager } from '../ToolManager/ToolManager';
import { useToolManagerState } from '../ToolManager/hooks/useToolManagerState/useToolManagerState';
import { useQuickADETour } from '../../../hooks/useQuickADETour/useQuickADETour';
import { MAX_TOOLS_THRESHOLD } from './constants';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { AddToolPopover } from '../ToolManager/components/AddToolPopover/AddToolPopover';
import { ToolsList } from './ToolsList/ToolsList';


interface ToolsOnboardingProps {
  children: React.ReactNode;
}

function ToolsOnboarding(props: ToolsOnboardingProps) {
  const t = useTranslations('ADE/Tools');
  const { children } = props;

  const { currentStep: quickStep, setStep: setQuickStep } = useQuickADETour();

  if (quickStep === 'tools') {
    return (
      <OnboardingAsideFocus
        className="w-full h-full"
        title={t('ToolsOnboarding.title')}
        placement="right-start"
        description={t('ToolsOnboarding.description')}
        isOpen
        totalSteps={4}
        nextStep={
          <Button
            data-testid="onboarding-next-finish"
            fullWidth
            size="large"
            bold
            onClick={() => {
              trackClientSideEvent(
                AnalyticsEvent.USER_ONBOARDING_STEP_COMPLETED,
                {
                  onboarding_type: 'create:new_agent',
                  onboarding_step: 'view_tools_panel',
                },
              );

              setQuickStep('done');
            }}
            label={t('ToolsOnboarding.quickNext')}
          />
        }
        currentStep={4}
      >
        <div className="h-full w-full">{children}</div>
      </OnboardingAsideFocus>
    );
  }

  return <PanelMainContent variant="noPadding">{children}</PanelMainContent>;
}

interface ToolUtilitiesProps {
  onSearchChange: (search: string) => void;
  search: string;
}

function ToolUtilities(props: ToolUtilitiesProps) {
  const { onSearchChange, search } = props;
  const { openToolManager } = useToolManagerState();

  const [showSearch, setShowSearch] = useState(false);

  const t = useTranslations('ADE/Tools');

  return (
    <HStack
      gap="small"
      justify="spaceBetween"
      position="relative"
      align="center"
      paddingX="small"
      paddingY="xsmall"
    >
      <SearchOverlay
        isVisible={showSearch}
        value={search}
        onChange={onSearchChange}
        onClose={() => {
          setShowSearch(false);
        }}
        placeholder={t('ToolsListPage.search.placeholder')}
        label={t('ToolsListPage.search.label')}
        closeLabel={t('ToolsListPage.search.close')}
      />
      <HStack align="center">
        <Button
          label={t('ToolsListPage.openExplorer')}
          color="secondary"
          size="xsmall"
          disabled={showSearch}
          bold
          data-testid="open-tool-explorer"
          preIcon={<ToolManagerIcon />}
          onClick={() => {
            openToolManager('/current-agent-tools');
          }}
        />
        <Button
          label={t('ToolsListPage.openVariables')}
          color="tertiary"
          bold
          disabled={showSearch}
          size="xsmall"
          preIcon={<VariableIcon />}
          onClick={() => {
            openToolManager('/tool-variables');
          }}
        />
        <Button
          bold
          disabled={showSearch}
          label={t('ToolsListPage.openRules')}
          color="tertiary"
          size="xsmall"
          preIcon={<RuleIcon />}
          onClick={() => {
            openToolManager('/tool-rules');
          }}
        />
      </HStack>
      <HStack align="center">
        <Button
          bold
          label={t('ToolsListPage.search.trigger')}
          color="tertiary"
          size="xsmall"
          disabled={showSearch}
          hideLabel
          onClick={() => {
            setShowSearch(!showSearch);
          }}
          active={showSearch}
          preIcon={<SearchIcon />}
        />
        <AddToolPopover disabled={showSearch} />
      </HStack>
    </HStack>
  );
}

function TooManyToolsWarning() {
  const { tools } = useCurrentAgent();
  const t = useTranslations('ADE/Tools');

  const toolCount = tools?.length || 0;

  if (toolCount <= MAX_TOOLS_THRESHOLD) {
    return null;
  }

  return (
    <HStack
      gap="small"
      paddingX="medium"
      paddingY="small"
      align="center"
      className="text-warning"
    >
      <WarningIcon size="xsmall" color="warning" />
      <Tooltip
        content={t('TooManyToolsWarning.tooltip', {
          count: toolCount,
          threshold: MAX_TOOLS_THRESHOLD,
        })}
      >
        <Typography variant="body3" className="cursor-help">
          {t('TooManyToolsWarning.description')}
        </Typography>
      </Tooltip>
    </HStack>
  );
}

export function ToolsPanel() {
  const [search, setSearch] = useState('');

  return (
    <ToolsOnboarding>
      <ToolManager />

      <VStack gap={false}>
        <ToolUtilities search={search} onSearchChange={setSearch} />
        <TooManyToolsWarning />
        <ToolsList search={search} />
      </VStack>
    </ToolsOnboarding>
  );
}

export function useToolsPanelTitle() {
  const t = useTranslations('ADE/Tools');
  const { tools } = useCurrentAgent();

  return t('title', {
    toolCount: tools?.length || '-',
  });
}

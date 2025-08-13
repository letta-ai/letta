'use client';
import React, { useCallback, useId, useMemo, useState } from 'react';
import {
  Accordion,
  CloseIcon,
  EditIcon,
  EyeOpenIcon,
  HStack,
  LinkOffIcon,
  RawInput,
  RuleIcon,
  SearchIcon,
  ToolManagerIcon,
  Tooltip,
  Typography,
  VariableIcon,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '../../OnboardingAsideFocus/OnboardingAsideFocus';

import { VStack } from '@letta-cloud/ui-component-library';
import { Dialog } from '@letta-cloud/ui-component-library';
import { Button, PanelMainContent } from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../hooks';
import type { AgentState, ToolType } from '@letta-cloud/sdk-core';
import { useAgentsServiceDetachTool, isLettaTool } from '@letta-cloud/sdk-core';
import { UseAgentsServiceRetrieveAgentKeyFn } from '@letta-cloud/sdk-core';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { ToolManager } from '../ToolManager/ToolManager';
import { useToolManagerState } from '../ToolManager/hooks/useToolManagerState/useToolManagerState';
import { useADETour } from '../../hooks/useADETour/useADETour';
import { useQuickADETour } from '../../hooks/useQuickADETour/useQuickADETour';
import { useNetworkInspector } from '../../hooks/useNetworkInspector/useNetworkInspector';
import { SpecificToolIcon } from '../ToolManager/components/SpecificToolIcon/SpecificToolIcon';
import { MAX_TOOLS_THRESHOLD } from './constants';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface RemoveToolPayload {
  toolName: string;
  toolId: string;
}

interface RemoveToolFromAgentDialogProps extends RemoveToolPayload {
  onClose: () => void;
}

function RemoveToolDialog(props: RemoveToolFromAgentDialogProps) {
  const { toolId, toolName, onClose } = props;
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/Tools');
  const queryClient = useQueryClient();
  const { handleInspectErrorWithClose } = useNetworkInspector();

  const {
    mutate,
    isError,
    isPending: isUpdatingTools,
  } = useAgentsServiceDetachTool({
    onSuccess: (nextAgentState) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId: agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            tools: nextAgentState.tools.filter((tool) => tool.id !== toolId),
          };
        },
      );

      onClose();
    },
  });

  const handleRemove = useCallback(() => {
    mutate({
      agentId,
      toolId,
    });
  }, [agentId, toolId, mutate]);

  const handleInspectError = useCallback(() => {
    handleInspectErrorWithClose(onClose);
  }, [handleInspectErrorWithClose, onClose]);

  return (
    <Dialog
      isOpen
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      errorMessage={isError ? t('RemoveToolDialog.error') : undefined}
      errorMessageAction={
        isError ? (
          <Button
            size="xsmall"
            label="Inspect Error"
            color="tertiary"
            onClick={handleInspectError}
          />
        ) : undefined
      }
      title={t('RemoveToolDialog.title', { toolName })}
      confirmText={t('RemoveToolDialog.confirm')}
      onConfirm={handleRemove}
      isConfirmBusy={isUpdatingTools}
    >
      {t('RemoveToolDialog.confirmation')}
    </Dialog>
  );
}

interface ToolsListProps {
  search: string;
}

function ToolsList(props: ToolsListProps) {
  const { search } = props;
  const { tools: currentTools } = useCurrentAgent();
  const { openToolManager } = useToolManagerState();

  const t = useTranslations('ADE/Tools');

  const [removeToolPayload, setRemoveToolPayload] =
    useState<RemoveToolPayload | null>(null);

  const toolsList: ParsedTool[] = useMemo(() => {
    if (!currentTools) {
      return [];
    }

    return currentTools
      .filter((tool) => {
        if (!search) {
          return true;
        }

        const toolName = tool.name?.toLowerCase() || '';
        const searchLower = search.toLowerCase();

        return toolName.includes(searchLower);
      })
      .toSorted((a, b) => {
        return a.name?.localeCompare(b.name || '') || 0;
      })
      .map((tool) => {
        const isCoreTool = isLettaTool(tool.tool_type);

        return {
          name: tool.name || '',
          id: tool.id || '',
          onClick: () => {
            openToolManager('/current-agent-tools', tool.id);
          },
          type: tool.tool_type || 'custom',
          sourceType: tool.source_type ?? undefined,
          icon: <SpecificToolIcon toolType={tool.tool_type} sourceType={tool.source_type} />,
          actionNode: (
            <HStack gap={false}>
              <Button
                hideLabel
                size="xsmall"
                color="tertiary"
                preIcon={isCoreTool ? <EyeOpenIcon /> : <EditIcon />}
                label={
                  isCoreTool
                    ? t('ToolsList.viewDetails')
                    : t('ToolsList.editTool')
                }
                onClick={() => {
                  openToolManager('/current-agent-tools', tool.id);
                }}
              />
              <Button
                hideLabel
                size="xsmall"
                color="tertiary"
                preIcon={<LinkOffIcon />}
                label={t('ToolsList.removeTool')}
                onClick={() => {
                  setRemoveToolPayload({
                    toolName: tool.name || '',
                    toolId: tool.id || '',
                  });
                }}
              />
            </HStack>
          ),
        };
      });
  }, [currentTools, openToolManager, search, t]);

  const lettaTools = useMemo(() => {
    return toolsList.filter((tool) => tool.type.includes('letta'));
  }, [toolsList]);

  const customTools = useMemo(() => {
    return toolsList.filter((tool) => !tool.type.includes('letta'));
  }, [toolsList]);

  return (
    <VStack
      gap="medium"
      paddingX="medium"
      paddingY="xsmall"
      paddingBottom="small"
    >
      {removeToolPayload && (
        <RemoveToolDialog
          toolId={removeToolPayload.toolId}
          toolName={removeToolPayload.toolName}
          onClose={() => {
            setRemoveToolPayload(null);
          }}
        />
      )}
      <ToolAccordion
        defaultOpen={false}
        label={t('ToolsList.lettaTools', { count: lettaTools.length })}
        tools={lettaTools}
      />
      <ToolAccordion
        defaultOpen
        label={t('ToolsList.customTools', { count: customTools.length })}
        tools={customTools}
      />
    </VStack>
  );
}

interface ParsedTool {
  name: string;
  id: string;
  type: ToolType;
  sourceType?: string;
  icon: React.ReactNode;
  actionNode?: React.ReactNode;
  onClick?: () => void;
}

interface ToolAccordionProps {
  tools: ParsedTool[];
  label: string;
  defaultOpen?: boolean;
}

function ToolAccordion(props: ToolAccordionProps) {
  const { tools, label, defaultOpen } = props;

  const id = useId();

  return (
    <Accordion
      defaultOpen={defaultOpen}
      id={id}
      caretType="arrow"
      trigger={
        <HStack>
          <Typography variant="body3">{label}</Typography>
        </HStack>
      }
    >
      <VStack paddingY="xsmall" gap="small">
        {tools.map((tool) => (
          <HStack
            justify="spaceBetween"
            color="background-grey2"
            align="center"
            paddingLeft="small"
            paddingRight="xxsmall"
            paddingY="xxsmall"
            border
            key={tool.id}
          >
            <HStack collapseWidth flex>
              <SpecificToolIcon size="xsmall" toolType={tool.type} sourceType={tool.sourceType} />
              <Typography
                noWrap
                fullWidth
                overflow="ellipsis"
                bold
                variant="body3"
              >
                {tool.name}
              </Typography>
            </HStack>
            <HStack>{tool.actionNode}</HStack>
          </HStack>
        ))}
      </VStack>
    </Accordion>
  );
}

interface ToolsOnboardingProps {
  children: React.ReactNode;
}

function ToolsOnboarding(props: ToolsOnboardingProps) {
  const t = useTranslations('ADE/Tools');
  const { children } = props;

  const { currentStep, setStep } = useADETour();
  const { currentStep: quickStep, setStep: setQuickStep } = useQuickADETour();

  if (currentStep === 'tools') {
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
            fullWidth
            size="large"
            bold
            onClick={() => {
              trackClientSideEvent(
                AnalyticsEvent.USER_ONBOARDING_STEP_COMPLETED,
                {
                  onboardingType: 'create:new_agent',
                  onboardingStep: 'view_tools_panel',
                },
              );

              setStep('chat');
            }}
            label={t('ToolsOnboarding.next')}
          />
        }
        currentStep={3}
      >
        <div className="h-full w-full">{children}</div>
      </OnboardingAsideFocus>
    );
  }

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
            fullWidth
            size="large"
            bold
            onClick={() => {
              trackClientSideEvent(
                AnalyticsEvent.USER_ONBOARDING_STEP_COMPLETED,
                {
                  onboardingType: 'create:new_agent',
                  onboardingStep: 'view_tools_panel',
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

  const onKeyUpInput = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        setShowSearch(false);
        onSearchChange('');
      }
    },
    [onSearchChange],
  );

  return (
    <HStack
      gap="small"
      justify="spaceBetween"
      position="relative"
      align="center"
      paddingX="small"
      paddingY="xsmall"
    >
      {showSearch && (
        <div
          style={{ paddingRight: '0.7rem', paddingTop: '0.1rem' }}
          className="absolute animate-in z-[1] duration-500  top-0 left-0 px-2 w-full"
        >
          <HStack align="center" color="background-grey" fullWidth>
            <RawInput
              fullWidth
              preIcon={<SearchIcon />}
              variant="tertiary"
              label={t('ToolsListPage.search.label')}
              autoFocus
              value={search}
              hideLabel
              onKeyUp={onKeyUpInput}
              onChange={(e) => {
                onSearchChange(e.target.value);
              }}
              placeholder={t('ToolsListPage.search.placeholder')}
            />
            <Button
              hideLabel
              size="xsmall"
              color="tertiary"
              preIcon={<CloseIcon />}
              label={t('ToolsListPage.search.close')}
              onClick={() => {
                setShowSearch(false);
                onSearchChange('');
              }}
            />
          </HStack>
        </div>
      )}
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

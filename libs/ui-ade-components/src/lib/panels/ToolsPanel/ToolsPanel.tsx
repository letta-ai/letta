'use client';
import React, { useCallback, useId, useMemo, useState } from 'react';
import {
  Accordion,
  Badge,
  EditIcon,
  ExternalLinkIcon,
  HStack,
  LinkOffIcon,
  RuleIcon,
  SearchIcon,
  ToolManagerIcon,
  Tooltip,
  Typography,
  VariableIcon,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { OnboardingAsideFocus } from '../../OnboardingAsideFocus/OnboardingAsideFocus';
import { SearchOverlay } from '../../shared/SearchOverlay';

import { VStack } from '@letta-cloud/ui-component-library';
import { Dialog } from '@letta-cloud/ui-component-library';
import { Button, PanelMainContent } from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../hooks';
import type { AgentState, Tool, ToolType } from '@letta-cloud/sdk-core';
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
import { AddToolPopover } from '../ToolManager/components/AddToolPopover/AddToolPopover';

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
      testId="detach-tool"
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

// MCP Tool metadata constants for schema health status (matching backend)
const MCP_TOOL_TAG_NAME_PREFIX = 'mcp:';
const MCP_TOOL_METADATA_SCHEMA_STATUS = `${MCP_TOOL_TAG_NAME_PREFIX}SCHEMA_STATUS`;

function getToolStrictModeInfo(tool: Tool): boolean {
  // Check if tool has json_schema
  if (!tool.json_schema) {
    return false;
  }

  // Check for MCP tool metadata
  const schemaStatus = tool.json_schema[MCP_TOOL_METADATA_SCHEMA_STATUS];
  if (schemaStatus === 'NON_STRICT_ONLY') {
    return true;
  }

  // Check the strict field directly
  // If strict is explicitly false, it's non-strict
  if (tool.json_schema.strict === false) {
    return true;
  }

  // Default to strict compliant
  return false;
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
        if (
          tool.tool_type === 'letta_voice_sleeptime_core' ||
          tool.tool_type === 'letta_files_core'
        ) {
          return false;
        }
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
        const isMCPTool = tool.tool_type === 'external_mcp';
        const isReadOnlyTool = isCoreTool || isMCPTool;
        const isNonStrict = getToolStrictModeInfo(tool);

        return {
          name: tool.name || '',
          id: tool.id || '',
          onClick: () => {
            openToolManager('/current-agent-tools', tool.id);
          },
          type: tool.tool_type || 'custom',
          sourceType: tool.source_type ?? undefined,
          icon: (
            <SpecificToolIcon
              toolType={tool.tool_type}
              sourceType={tool.source_type}
            />
          ),
          nonStrict: isNonStrict,
          actionNode: (
            <HStack gap={false}>
              <Button
                hideLabel
                size="xsmall"
                color="tertiary"
                preIcon={isReadOnlyTool ? <ExternalLinkIcon /> : <EditIcon />}
                label={
                  isReadOnlyTool
                    ? t('ToolsList.viewDetails')
                    : t('ToolsList.editTool')
                }
                onClick={() => {
                  openToolManager('/current-agent-tools', tool.id);
                }}
              />
              <Button
                data-testid={`detach-tool:${tool.name}`}
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
  isNonStrict?: boolean;
}

interface ToolAccordionProps {
  tools: ParsedTool[];
  label: string;
  defaultOpen?: boolean;
}

function ToolAccordion(props: ToolAccordionProps) {
  const { tools, label, defaultOpen } = props;
  const t = useTranslations('ToolManager/SingleMCPServer');

  const id = useId();

  return (
    <Accordion
      defaultOpen={defaultOpen}
      id={id}
      caretType="arrow"
      trigger={
        <HStack data-testId="core-tools-accordion">
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
            <HStack collapseWidth flex gap="small">
              <SpecificToolIcon
                size="xsmall"
                toolType={tool.type}
                sourceType={tool.sourceType}
              />
              <Typography
                noWrap
                fullWidth
                overflow="ellipsis"
                bold
                variant="body3"
                data-testId={`tool-attached:${tool.name}`}
              >
                {tool.name}
              </Typography>
              {tool.isNonStrict && (
                <Tooltip content={t('ServerToolsList.schemaHealth.notStrict.tooltip')}>
                  <Badge variant="warning" size="small" content={t('ServerToolsList.schemaHealth.notStrict.label')} />
                </Tooltip>
              )}
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

'use client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  AddLinkIcon,
  EditIcon,
  HStack,
  LinkOffIcon,
  OnboardingAsideFocus,
  RuleIcon,
  ToolManagerIcon,
  VariableIcon,
} from '@letta-cloud/ui-component-library';
import type { FileTreeContentsType } from '@letta-cloud/ui-component-library';
import { VStack } from '@letta-cloud/ui-component-library';
import { brandKeyToLogo, isBrandKey } from '@letta-cloud/ui-component-library';
import { getIsGenericFolder } from '@letta-cloud/ui-component-library';
import {
  Dialog,
  FileTree,
  Logo,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';
import { Button, PanelMainContent } from '@letta-cloud/ui-component-library';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../hooks';
import type { AgentState } from '@letta-cloud/sdk-core';
import { useAgentsServiceDetachTool } from '@letta-cloud/sdk-core';
import { isLettaTool } from '@letta-cloud/sdk-core';
import { UseAgentsServiceRetrieveAgentKeyFn } from '@letta-cloud/sdk-core';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { ToolManager } from '../ToolManager/ToolManager';
import {
  ToolManagerProvider,
  useToolManagerState,
} from '../ToolManager/hooks/useToolManagerState/useToolManagerState';
import { useADETour } from '../../hooks/useADETour/useADETour';

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

  return (
    <Dialog
      isOpen
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      errorMessage={isError ? t('RemoveToolDialog.error') : undefined}
      title={t('RemoveToolDialog.title', { toolName })}
      confirmText={t('RemoveToolDialog.confirm')}
      onConfirm={handleRemove}
      isConfirmBusy={isUpdatingTools}
    >
      {t('RemoveToolDialog.confirmation')}
    </Dialog>
  );
}

function ToolsList() {
  const { tools: currentTools } = useCurrentAgent();
  const { openToolManager } = useToolManagerState();

  const search = '';
  const t = useTranslations('ADE/Tools');

  const [removeToolPayload, setRemoveToolPayload] =
    useState<RemoveToolPayload | null>(null);

  const toolsList: FileTreeContentsType = useMemo(() => {
    if (!currentTools) {
      return [];
    }

    let lettaCoreToolCount = 0;
    let otherToolCount = 0;

    const fileTreeTools: FileTreeContentsType = [
      {
        name: '',
        id: 'core-tools',
        contents: [],
        actionNode: (
          <Button
            hideLabel
            size="xsmall"
            _use_rarely_className="p-1"
            color="tertiary"
            preIcon={<AddLinkIcon />}
            label={t('ToolsList.attachCoreTool')}
            onClick={() => {
              openToolManager('/letta-tools');
            }}
          />
        ),
      },
      {
        id: 'other-tools',
        name: '',
        contents: [],
        defaultOpen: true,
        actionNode: (
          <Button
            hideLabel
            size="xsmall"
            _use_rarely_className="p-1"
            color="tertiary"
            preIcon={<AddLinkIcon />}
            label={t('ToolsList.attachCustomTool')}
            onClick={() => {
              openToolManager('/my-tools');
            }}
          />
        ),
      },
    ];

    currentTools.forEach((tool) => {
      if (!tool.name?.toLowerCase().includes(search.toLowerCase())) {
        return;
      }

      if (isLettaTool(tool)) {
        lettaCoreToolCount += 1;
        if (getIsGenericFolder(fileTreeTools[0])) {
          fileTreeTools[0].contents.push({
            name: tool.name || '',
            id: tool.id || '',
            onClick: () => {
              openToolManager('/current-agent-tools', tool.id);
            },
            actionNode: (
              <Button
                hideLabel
                size="xsmall"
                _use_rarely_className="p-1"
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
            ),
            icon: <Logo size="small" />,
          });
        }
      } else {
        otherToolCount += 1;
        if (getIsGenericFolder(fileTreeTools[1])) {
          const creator = tool.tags?.find((tag) => isBrandKey(tag)) || '';

          fileTreeTools[1].contents.push({
            name: tool.name || '',
            id: tool.id,
            onClick: () => {
              openToolManager('/current-agent-tools', tool.id);
            },
            icon: isBrandKey(creator) ? brandKeyToLogo(creator) : <ToolsIcon />,
            actionNode: (
              <HStack gap={false}>
                <Button
                  hideLabel
                  size="xsmall"
                  _use_rarely_className="p-1"
                  color="tertiary"
                  preIcon={<EditIcon />}
                  label={t('ToolsList.editTool')}
                  onClick={() => {
                    openToolManager('/current-agent-tools', tool.id);
                  }}
                />
                <Button
                  hideLabel
                  size="xsmall"
                  _use_rarely_className="p-1"
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
          });
        }
      }
    });

    fileTreeTools[0].name = t('ToolsList.lettaCoreTools', {
      toolCount: lettaCoreToolCount,
    });
    fileTreeTools[0].infoTooltip = {
      text: t('ToolsList.lettaCoreToolsInfo'),
    };
    fileTreeTools[1].name = t('ToolsList.otherTools', {
      toolCount: otherToolCount,
    });

    return fileTreeTools;
  }, [currentTools, openToolManager, search, t]);

  return (
    <VStack gap={false} paddingX="small">
      {removeToolPayload && (
        <RemoveToolDialog
          toolId={removeToolPayload.toolId}
          toolName={removeToolPayload.toolName}
          onClose={() => {
            setRemoveToolPayload(null);
          }}
        />
      )}
      <FileTree root={toolsList} />
    </VStack>
  );
}

interface ToolsOnboardingProps {
  children: React.ReactNode;
}

function ToolsOnboarding(props: ToolsOnboardingProps) {
  const t = useTranslations('ADE/Tools');
  const { children } = props;

  const { currentStep, setStep } = useADETour();

  if (currentStep !== 'tools') {
    return <>{children}</>;
  }

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
            setStep('chat');
          }}
          label={t('ToolsOnboarding.next')}
        />
      }
      currentStep={3}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

function ToolUtilities() {
  const { openToolManager } = useToolManagerState();

  const t = useTranslations('ADE/Tools');

  return (
    <HStack gap="small" align="center" paddingX="small" paddingY="xsmall">
      <Button
        label={t('ToolsListPage.openExplorer')}
        color="secondary"
        size="xsmall"
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
        size="xsmall"
        preIcon={<VariableIcon />}
        onClick={() => {
          openToolManager('/tool-variables');
        }}
      />
      <Button
        bold
        label={t('ToolsListPage.openRules')}
        color="tertiary"
        size="xsmall"
        preIcon={<RuleIcon />}
        onClick={() => {
          openToolManager('/tool-rules');
        }}
      />
    </HStack>
  );
}

export function ToolsPanel() {
  const { agentName, isTemplate } = useCurrentAgentMetaData();
  return (
    <ToolManagerProvider>
      <ToolsOnboarding>
        <PanelMainContent variant="noPadding">
          <ToolManager isTemplate={isTemplate} agentName={agentName} />

          <VStack gap={false}>
            <ToolUtilities />
            <ToolsList />
          </VStack>
        </PanelMainContent>
      </ToolsOnboarding>
    </ToolManagerProvider>
  );
}

export function useToolsPanelTitle() {
  const t = useTranslations('ADE/Tools');
  const { tools } = useCurrentAgent();

  return t('title', {
    toolCount: tools?.length || '-',
  });
}

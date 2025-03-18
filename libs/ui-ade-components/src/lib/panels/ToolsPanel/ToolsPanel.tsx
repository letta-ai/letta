'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { ExploreIcon, HStack } from '@letta-cloud/ui-component-library';
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
import {
  Button,
  PanelBar,
  PanelMainContent,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../hooks';
import type { AgentState } from '@letta-cloud/sdk-core';
import { useAgentsServiceDetachTool } from '@letta-cloud/sdk-core';
import { isLettaTool } from '@letta-cloud/sdk-core';
import { UseAgentsServiceRetrieveAgentKeyFn } from '@letta-cloud/sdk-core';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useADEPermissions } from '../../hooks/useADEPermissions/useADEPermissions';
import { ToolManager } from '../ToolManager/ToolManager';
import {
  ToolManagerProvider,
  useToolManagerState,
} from '../ToolManager/hooks/useToolManagerState/useToolManagerState';
import { ToolsExplorer } from '../ToolsExplorer/ToolsExplorer';
import { useToolsExplorerState } from '../ToolsExplorer/useToolsExplorerState/useToolsExplorerState';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { findProviderFromTags } from '../ToolsExplorer/findProviderFromTags/findProviderFromTags';
import { OldToolRulesEditor } from '../ToolRules/ToolRules';

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

function useNewToolsUI() {
  const { isLoading, data } = useFeatureFlag('NEW_TOOLS');

  return !isLoading && data;
}

interface ToolsProps {
  search: string;
}

function ToolsList(props: ToolsProps) {
  const { search } = props;
  const { tools: currentTools } = useCurrentAgent();
  const { openToolManager } = useToolManagerState();
  const { openToolExplorer } = useToolsExplorerState();
  const showNewToolsUI = useNewToolsUI();

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

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
      },
      {
        id: 'other-tools',
        name: '',
        contents: [],
        defaultOpen: true,
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
              if (!showNewToolsUI) {
                openToolExplorer({
                  currentTool: {
                    mode: 'view',
                    data: {
                      id: tool.id || '',
                      provider: findProviderFromTags(tool),
                    },
                  },
                });
                return;
              }

              openToolManager('/current-agent-tools', tool.id);
            },
            actions: canUpdateAgent
              ? [
                  {
                    id: 'remove-tool',
                    label: t('ToolsList.removeTool'),
                    onClick: () => {
                      setRemoveToolPayload({
                        toolName: tool.name || '',
                        toolId: tool.id || '',
                      });
                    },
                  },
                ]
              : undefined,
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
              if (!showNewToolsUI) {
                openToolExplorer({
                  currentTool: {
                    mode: 'view',
                    data: {
                      id: tool.id || '',
                      providerId: tool.name || '',
                      provider: findProviderFromTags(tool),
                    },
                  },
                });
                return;
              }

              openToolManager('/current-agent-tools', tool.id);
            },
            icon: isBrandKey(creator) ? brandKeyToLogo(creator) : <ToolsIcon />,
            actions: canUpdateAgent
              ? [
                  {
                    id: 'remove-tool',
                    label: t('ToolsList.removeTool'),
                    onClick: () => {
                      setRemoveToolPayload({
                        toolName: tool.name || '',
                        toolId: tool.id || '',
                      });
                    },
                  },
                ]
              : undefined,
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
  }, [
    currentTools,
    showNewToolsUI,
    openToolManager,
    openToolExplorer,
    search,
    canUpdateAgent,
    t,
  ]);

  return (
    <PanelMainContent>
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
    </PanelMainContent>
  );
}

function OpenToolManagerButton() {
  const { openToolManager } = useToolManagerState();
  const { openToolExplorer } = useToolsExplorerState();
  const showNewToolsUI = useNewToolsUI();

  const t = useTranslations('ADE/Tools');

  if (!showNewToolsUI) {
    return (
      <HStack>
        <OldToolRulesEditor />
        <Button
          label={t('ToolsListPage.openExplorer')}
          color="secondary"
          data-testid="open-tool-explorer"
          hideLabel
          onClick={() => {
            openToolExplorer();
          }}
          preIcon={<ExploreIcon />}
        />
      </HStack>
    );
  }

  return (
    <Button
      label={t('ToolsListPage.openExplorer')}
      color="secondary"
      data-testid="open-tool-explorer"
      hideLabel
      onClick={() => {
        openToolManager('/current-agent-tools');
      }}
      preIcon={<ExploreIcon />}
    />
  );
}

export function ToolsPanel() {
  const [search, setSearch] = useState('');
  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  return (
    <ToolManagerProvider>
      <VStack overflow="hidden" gap={false}>
        <ToolManager />
        <ToolsExplorer />
        <PanelBar
          searchValue={search}
          onSearch={(value) => {
            setSearch(value);
          }}
          actions={
            canUpdateAgent && (
              <HStack>
                <OpenToolManagerButton />
              </HStack>
            )
          }
        />
        <ToolsList search={search} />
      </VStack>
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

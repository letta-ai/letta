'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type { FileTreeContentsType } from '@letta-cloud/component-library';
import { VStack } from '@letta-cloud/component-library';
import { brandKeyToLogo, isBrandKey } from '@letta-cloud/component-library';
import { getIsGenericFolder } from '@letta-cloud/component-library';
import {
  Dialog,
  FileTree,
  Logo,
  PlusIcon,
  ToolsIcon,
} from '@letta-cloud/component-library';
import {
  Button,
  PanelBar,
  PanelMainContent,
} from '@letta-cloud/component-library';
import { useCurrentAgent } from '../../hooks';
import type { AgentState } from '@letta-cloud/letta-agents-api';
import { isLettaTool } from '@letta-cloud/letta-agents-api';
import { useAgentsServiceRemoveToolFromAgent } from '@letta-cloud/letta-agents-api';
import { UseAgentsServiceGetAgentKeyFn } from '@letta-cloud/letta-agents-api';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import {
  findProviderFromTags,
  ToolsExplorer,
  useToolsExplorerState,
} from '../ToolsExplorer/ToolsExplorer';

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
  } = useAgentsServiceRemoveToolFromAgent({
    onSuccess: (nextAgentState) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceGetAgentKeyFn({
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

interface ToolsProps {
  search: string;
}

function ToolsList(props: ToolsProps) {
  const { search } = props;
  const { tools: currentTools } = useCurrentAgent();
  const { openToolExplorer } = useToolsExplorerState();

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
              openToolExplorer({
                currentTool: {
                  mode: 'view',
                  data: {
                    id: tool.id || '',
                    provider: findProviderFromTags(tool),
                  },
                },
              });
            },
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
            },
            icon: isBrandKey(creator) ? brandKeyToLogo(creator) : <ToolsIcon />,
            actions: [
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
            ],
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
  }, [currentTools, openToolExplorer, search, t]);

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

export function ToolsPanel() {
  const [search, setSearch] = useState('');
  const t = useTranslations('ADE/Tools');
  const { openToolExplorer } = useToolsExplorerState();

  return (
    <VStack overflow="hidden" gap={false}>
      <ToolsExplorer />
      <PanelBar
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
        }}
        actions={
          <Button
            label={t('ToolsListPage.openExplorer')}
            color="secondary"
            data-testid="open-tool-explorer"
            hideLabel
            onClick={() => {
              openToolExplorer();
            }}
            preIcon={<PlusIcon />}
          />
        }
      />
      <ToolsList search={search} />
    </VStack>
  );
}

export function useToolsPanelTitle() {
  const t = useTranslations('ADE/Tools');
  const { tools } = useCurrentAgent();

  return t('title', {
    toolCount: tools?.length || '-',
  });
}

import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../../../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai/index';
import { currentAdvancedCoreMemoryAtom } from '../currentAdvancedCoreMemoryAtom';
import {
  type AgentState,
  useAgentsServiceDetachCoreMemoryBlock,
  UseAgentsServiceRetrieveAgentKeyFn,
  UseBlocksServiceListAgentsForBlockKeyFn,
} from '@letta-cloud/sdk-core';
import React, { useCallback, useState } from 'react';
import { useADEPermissions } from '../../../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import {
  Button,
  Dialog,
  LinkOffIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

interface DetachMemoryBlockDialogProps {
  blockId: string;
}

export function DetachMemoryBlock(props: DetachMemoryBlockDialogProps) {
  const t = useTranslations('ADE/AdvancedCoreMemoryEditor/DetachMemoryBlock');
  const { id: agentId } = useCurrentAgent();
  const { blockId } = props;
  const queryClient = useQueryClient();
  const setSelectMemoryBlockLabel = useSetAtom(currentAdvancedCoreMemoryAtom);

  const {
    isError: detachError,
    mutate: detachBlock,
    reset: resetDeleting,
    isPending: isDeletingBlock,
  } = useAgentsServiceDetachCoreMemoryBlock();

  const [isOpen, setIsOpen] = useState(false);

  const handleDetachBlock = useCallback(() => {
    trackClientSideEvent(AnalyticsEvent.DETACH_BLOCK_FROM_CORE_MEMORY, {
      agent_id: agentId,
    });

    detachBlock(
      {
        blockId,
        agentId,
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: UseBlocksServiceListAgentsForBlockKeyFn({
              blockId: blockId,
              includeRelationships: [],
            }),
            exact: false,
          });

          queryClient.setQueriesData<AgentState | undefined>(
            {
              queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                agentId: agentId,
              }),
            },
            (data) => {
              if (!data) {
                return data;
              }

              const nextBlocks = data.memory.blocks.filter(
                (block) => block.id !== blockId,
              );

              if (nextBlocks?.[0]?.label) {
                setSelectMemoryBlockLabel((prev) => ({
                  ...prev,
                  selectedMemoryBlockLabel: nextBlocks[0].label || '',
                }));
              } else {
                setSelectMemoryBlockLabel((prev) => ({
                  ...prev,
                  selectedMemoryBlockLabel: '',
                }));
              }

              return {
                ...data,
                memory: {
                  ...data.memory,
                  blocks: nextBlocks,
                },
              };
            },
          );

          resetDeleting();
          setIsOpen(false);
        },
      },
    );
  }, [
    agentId,
    setSelectMemoryBlockLabel,
    detachBlock,
    blockId,
    queryClient,
    resetDeleting,
  ]);

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  if (!canUpdateAgent) {
    return null;
  }

  return (
    <Dialog
      errorMessage={detachError ? t('error') : undefined}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <Button
          hideLabel
          data-testid="detach-memory-block"
          preIcon={<LinkOffIcon />}
          color="tertiary"
          label={t('trigger')}
        />
      }
      testId="detach-memory-block-dialog"
      title={t('title')}
      onConfirm={handleDetachBlock}
      confirmText={t('confirm')}
      isConfirmBusy={isDeletingBlock}
    >
      <VStack fullWidth gap="form">
        <Typography>{t('description')}</Typography>
      </VStack>
    </Dialog>
  );
}

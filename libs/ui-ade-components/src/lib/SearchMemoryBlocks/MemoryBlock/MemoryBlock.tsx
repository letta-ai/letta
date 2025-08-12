import {
  type AgentState,
  type Block,
  isAPIError,
  useAgentsServiceAttachCoreMemoryBlock,
  UseAgentsServiceRetrieveAgentKeyFn,
  UseBlocksServiceListAgentsForBlockKeyFn,
} from '@letta-cloud/sdk-core';
import {
  Button,
  CopyButton,
  HStack,
  InvaderSharedAgentIcon,
  MemoryIcon,
  MiddleTruncate,
  PlusIcon,
  SharedAgentsPopover,
  toast,
  Tooltip,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSharedAgents } from '../../hooks/useSharedAgents/useSharedAgents';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { useADEAppContext } from '../../AppContext/AppContext';

interface AttachMemoryBlockButtonProps {
  blockId: string;
}

function AttachMemoryBlockButton(props: AttachMemoryBlockButtonProps) {
  const agent = useCurrentAgent();
  const { user } = useADEAppContext();
  const { blockId } = props;
  const t = useTranslations('ADE/MemoryBlock.AttachMemoryBlockButton');
  const isMemoryBlockAttached = useMemo(() => {
    if (!agent?.memory) return false;
    return agent.memory.blocks.some((block) => block.id === blockId);
  }, [agent, blockId]);

  const queryClient = useQueryClient();
  const { isPending, isSuccess, mutate } =
    useAgentsServiceAttachCoreMemoryBlock();

  const attachMemoryBlock = useCallback(() => {
    if (!agent || isMemoryBlockAttached) return;

    trackClientSideEvent(AnalyticsEvent.ATTACH_BLOCK_TO_CORE_MEMORY, {
      userId: user?.id || '',
      agentId: agent.id,
    });

    mutate(
      {
        agentId: agent.id,
        blockId,
      },
      {
        onSuccess: (nextAgentState) => {
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
                agentId: agent.id,
              }),
            },
            () => {
              return nextAgentState;
            },
          );
        },
        onError: (error) => {
          if (isAPIError(error)) {
            toast.error(t('attachError'));
          }
        },
      },
    );
  }, [t, queryClient, agent, blockId, isMemoryBlockAttached, mutate, user?.id]);

  if (isMemoryBlockAttached) {
    return (
      <Button
        disabled
        size="xsmall"
        preIcon={<PlusIcon />}
        color="secondary"
        label={t('memoryBlockAttached')}
      ></Button>
    );
  }

  return (
    <Button
      preIcon={<PlusIcon />}
      size="xsmall"
      busy={isPending || isSuccess}
      color="secondary"
      onClick={attachMemoryBlock}
      label={t('attachMemoryBlock')}
    />
  );
}

interface MemoryBlockProps {
  block: Block;
}

interface SharedAgentsBlockProps {
  blockId: string;
}

function SharedAgentsBlock(props: SharedAgentsBlockProps) {
  const { blockId } = props;

  const t = useTranslations('ADE/SearchMemoryBlocks.SharedAgentsBlock');

  const sharedAgents = useSharedAgents(blockId);

  if (!sharedAgents) {
    return null;
  }

  return (
    <SharedAgentsPopover
      agents={sharedAgents}
      allowSingleAgent
      trigger={
        <div className="h-full">
          <Tooltip
            asChild
            content={t('tooltip', { count: sharedAgents.length })}
          >
            <HStack
              align="center"
              border
              paddingX="xsmall"
              fullHeight
              gap="small"
            >
              <InvaderSharedAgentIcon size="xsmall" />
              <Typography variant="body3">{sharedAgents.length}</Typography>
            </HStack>
          </Tooltip>
        </div>
      }
    ></SharedAgentsPopover>
  );
}

export function MemoryBlock(props: MemoryBlockProps) {
  const { block } = props;
  const { label, value, description, id: blockId } = block;
  const agent = useCurrentAgent();

  const t = useTranslations('ADE/MemoryBlock');

  return (
    <VStack gap="small" padding="xsmall" border fullHeight fullWidth>
      <HStack align="center" fullWidth justify="spaceBetween">
        <HStack gap="small" align="center">
          <MemoryIcon />
          <Typography overrideEl="span" bold variant="body2">
            {label}
          </Typography>
        </HStack>
        <HStack>
          <SharedAgentsBlock blockId={blockId || ''} />
          <HStack
            color="background-grey3"
            paddingX="xsmall"
            gap="text"
            align="center"
          >
            <Typography color="lighter" variant="body3">
              <MiddleTruncate visibleStart={5} visibleEnd={10}>
                {blockId || ''}
              </MiddleTruncate>
            </Typography>
            <CopyButton
              textToCopy={blockId || ''}
              size="xsmall"
              color="tertiary"
              hideLabel
            />
          </HStack>
          {agent?.id && <AttachMemoryBlockButton blockId={blockId || ''} />}
        </HStack>
      </HStack>
      <VStack>
        <VStack paddingX="xxsmall" paddingY="xxsmall" color="background-grey3">
          <Typography
            className="line-clamp-1"
            overrideEl="span"
            variant="body3"
          >
            {description || (
              <Typography variant="body3" italic overrideEl="span">
                {t('noDescription')}
              </Typography>
            )}
          </Typography>
        </VStack>
        <Typography className="line-clamp-2" overrideEl="span" variant="body3">
          {value || (
            <Typography variant="body3" italic overrideEl="span">
              {t('noValue')}
            </Typography>
          )}
        </Typography>
      </VStack>
    </VStack>
  );
}

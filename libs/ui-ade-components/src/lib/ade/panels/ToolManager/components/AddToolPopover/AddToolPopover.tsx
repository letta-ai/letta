'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../../../../hooks';
import {
  useToolsServiceListTools,
  useAgentsServiceAttachTool,
  useToolsServiceAddComposioTool,
} from '@letta-cloud/sdk-core';
import {
  Button,
  HStack,
  Popover,
  RawInput,
  SearchIcon,
  Typography,
  VStack,
  PlusIcon,
  LoadingEmptyStatusComponent,
  toast,
} from '@letta-cloud/ui-component-library';
import { SpecificToolIcon } from '../SpecificToolIcon/SpecificToolIcon';
import { useOptimisticAgentTools } from '../../hooks/useOptimisticAgentTools/useOptimisticAgentTools';
import { cn } from '@letta-cloud/ui-styles';

interface AddToolPopoverProps {
  disabled?: boolean;
}

export function AddToolPopover(props: AddToolPopoverProps) {
  const { disabled } = props;
  const t = useTranslations('ADE/Tools');
  const { tools: attachedTools, id: agentId } = useCurrentAgent();
  const [search, setSearch] = useState('');

  const { data: allTools, isLoading, isError } = useToolsServiceListTools({
    limit: 20,
    search: search || undefined,
  });
  const { mutate: attachTool, mutateAsync: attachToolAsync } = useAgentsServiceAttachTool();
  const { mutateAsync: addComposioTool } = useToolsServiceAddComposioTool();
  const { addOptimisticTool, removeOptimisticTool, updateAgentTools } = useOptimisticAgentTools(agentId || '');

  const attachedIds = useMemo(() => {
    return new Set((attachedTools || []).map((tool) => tool.id));
  }, [attachedTools]);


  const filteredTools = useMemo(() => {
    const tools = allTools || [];
    return tools.toSorted((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allTools]);

  const handleAttachTool = useCallback(async (tool: typeof filteredTools[0]) => {
    if (!tool.id || !agentId) return;

    try {
      if (tool.tool_type === 'external_composio') {
        const created = await addComposioTool({ composioActionName: tool.id });
        const newToolId = created.id || '';
        if (!newToolId) return;

        const nextState = await attachToolAsync({ agentId, toolId: newToolId });
        updateAgentTools(nextState);
        toast.success(t('AddToolToAgentButton.success'));
        return;
      }


       if (tool.tool_type) {
         addOptimisticTool({
           id: tool.id,
           name: tool.name || tool.id,
           tool_type: tool.tool_type,
         });
       }

       attachTool(
         { agentId, toolId: tool.id },
         {
           onError: () => {
             removeOptimisticTool(tool.id || '');
             toast.error(t('AddToolToAgentButton.error'));
           },
           onSuccess: (payload) => {
             updateAgentTools(payload);
             toast.success(t('AddToolToAgentButton.success'));
           },
         },
       );
    } catch (_e) {
      toast.error(t('AddToolToAgentButton.error'));
    }
  }, [
    agentId,
    addComposioTool,
    attachToolAsync,
    addOptimisticTool,
    removeOptimisticTool,
    updateAgentTools,
    attachTool,
    t,
  ]);

  return (
    <Popover
      triggerAsChild
      align="start"
      className="min-w-[260px] max-w-[340px] max-h-[300px] overflow-y-auto bg-background-grey"
      trigger={
        <Button
          size="xsmall"
          color="secondary"
          preIcon={<PlusIcon />}
          disabled={disabled}
          label={t('addTool')}
          hideLabel
        />
      }
    >
      <VStack gap="small" className="px-3 pb-3 pt-1 w-full">
        <RawInput
          fullWidth
          variant="tertiary"
          preIcon={<SearchIcon />}
          hideLabel
          label={t('ToolsListPage.search.label')}
          placeholder={t('ToolsListPage.search.placeholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
        />
        {isLoading || isError ? (
          <LoadingEmptyStatusComponent
            isLoading={isLoading}
            isError={isError}
            errorMessage={t('ErrorMessageAlert.title')}
          />
        ) : (
          <VStack gap="small">
            {filteredTools.map((tool) => {
              const alreadyAttached = attachedIds.has(tool.id || '');
              return (
                <HStack
                  key={tool.id}
                  justify="spaceBetween"
                  align="center"
                  color="background-grey2"
                  paddingLeft="small"
                  paddingRight="xxsmall"
                  paddingY="xxsmall"
                  border
                  onClick={() => {
                    if (alreadyAttached) return;
                    void handleAttachTool(tool);
                  }}
                  className={cn(
                    'pt-2 pb-2 my-0.25',
                    alreadyAttached ? 'opacity-50' : 'cursor-pointer hover:bg-secondary-hover'
                  )}
                >
                  <HStack collapseWidth flex>
                    <SpecificToolIcon size="xsmall" toolType={tool.tool_type} />
                    <Typography noWrap fullWidth overflow="ellipsis" bold variant="body3">
                      {tool.name}
                    </Typography>
                  </HStack>
                  <HStack></HStack>
                </HStack>
              );
            })}
          </VStack>
        )}
      </VStack>
    </Popover>
  );
}

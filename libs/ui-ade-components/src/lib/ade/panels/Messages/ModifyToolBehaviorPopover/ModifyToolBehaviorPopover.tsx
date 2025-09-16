'use client';
import './ModifyToolBehaviorPopover.scss';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  Button,
  toast,
  RuleIcon,
  HStack,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';
import { useMemo, useCallback, useState } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import { useCurrentAgent } from '../../../../hooks';
import { useToolManagerState } from '../../ToolManager/hooks/useToolManagerState/useToolManagerState';
import { useTranslations } from '@letta-cloud/translations';
import {
  useAgentsServiceModifyAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
  type AgentState,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import type {
  SupportedToolRuleTypes,
  SupportedToolRuleNameTypes,
} from '../../ToolRules/types';
import { cn } from '@letta-cloud/ui-styles';

interface ModifyToolBehaviorPopoverProps {
  toolName: string;
}

interface MutationContext {
  previousData?: AgentState;
}

export function ModifyToolBehaviorPopover({
  toolName,
}: ModifyToolBehaviorPopoverProps) {
  const agent = useCurrentAgent();
  const { openToolManager } = useToolManagerState();
  const t = useTranslations('ADE/ModifyToolBehaviorPopover');
  const { id: agentId } = agent;
  const queryClient = useQueryClient();

  const { mutate } = useAgentsServiceModifyAgent({
    onError: (_, _v, context: MutationContext | undefined) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        queryClient.setQueryData(
          UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
          context.previousData,
        );
      }
      toast.error(t('error'));
    },
    onMutate: async (variables): Promise<MutationContext> => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({
        queryKey: UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
      });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<AgentState>(
        UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
      );

      // Optimistically update the cache
      queryClient.setQueryData<AgentState | undefined>(
        UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            tool_rules: variables.requestBody.tool_rules || oldData.tool_rules,
          };
        },
      );

      // Return context for rollback
      return { previousData };
    },
    onSuccess: (data) => {
      // Update with server response to ensure consistency
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            tool_rules: data.tool_rules,
          };
        },
      );
    },
  });

  const RULE_TEMPLATES = useMemo(
    (): Record<SupportedToolRuleNameTypes, SupportedToolRuleTypes> => ({
      constrain_child_tools: {
        type: 'constrain_child_tools',
        tool_name: '',
        children: [],
      },
      requires_approval: {
        type: 'requires_approval',
        tool_name: '',
      },
      run_first: { type: 'run_first', tool_name: '' },
      exit_loop: { type: 'exit_loop', tool_name: '' },
      continue_loop: { type: 'continue_loop', tool_name: '' },
      required_before_exit: { type: 'required_before_exit', tool_name: '' },
      conditional: {
        type: 'conditional',
        tool_name: '',
        default_child: '',
        require_output_mapping: false,
        child_output_mapping: {},
      },
      max_count_per_step: {
        type: 'max_count_per_step',
        tool_name: '',
        max_count_limit: 1,
      },
    }),
    [],
  );

  const [open, setIsOpen] = useState(false);

  // Debounced mutation function
  const debouncedMutate = useDebouncedCallback(
    () => {
      // Get the current state from the query cache when executing
      const currentData = queryClient.getQueryData<AgentState>(
        UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
      );

      if (currentData?.tool_rules) {
        mutate({
          agentId,
          requestBody: {
            tool_rules: currentData.tool_rules,
          },
        });
      }
    },
    1000, // 300ms debounce
  );

  const handleToggleRuleForTool = useCallback(
    (
      ruleType: SupportedToolRuleNameTypes,
      toolName: string,
      isEnabled: boolean,
    ) => {
      const currentRules = agent?.tool_rules || [];

      let updatedRules: SupportedToolRuleTypes[];

      if (isEnabled) {
        // Remove the rule
        updatedRules = currentRules.filter(
          (rule) => !(rule.tool_name === toolName && rule.type === ruleType),
        );
      } else {
        // Add the rule
        const newRule = {
          ...RULE_TEMPLATES[ruleType],
          tool_name: toolName,
        };
        updatedRules = [...currentRules, newRule];
      }

      // Immediately update the optimistic cache
      queryClient.setQueryData<AgentState | undefined>(
        UseAgentsServiceRetrieveAgentKeyFn({ agentId }),
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            tool_rules: updatedRules,
          };
        },
      );

      // Use debounced mutation (no arguments needed since it reads from cache)
      debouncedMutate();
    },
    [RULE_TEMPLATES, agent?.tool_rules, agentId, queryClient, debouncedMutate],
  );

  const currentToolRules = useMemo(() => {
    if (!agent?.tool_rules) return [];
    return agent.tool_rules.filter((rule) => rule.tool_name === toolName);
  }, [agent?.tool_rules, toolName]);

  const existingRuleTypes = useMemo(() => {
    return currentToolRules.map((rule) => rule.type);
  }, [currentToolRules]);

  const allAvailableRules = useMemo(() => {
    const options: Array<{
      key: SupportedToolRuleNameTypes;
      label: string;
      enabled: boolean;
      disabled?: boolean;
    }> = [];

    // Handle mutually exclusive rules (exit_loop and continue_loop)
    const hasExitLoop = existingRuleTypes.includes('exit_loop');
    const hasContinueLoop = existingRuleTypes.includes('continue_loop');

    options.push({
      key: 'exit_loop',
      label: t('exitLoop'),
      enabled: hasExitLoop,
      disabled: hasContinueLoop,
    });

    options.push({
      key: 'required_before_exit',
      label: t('requiredBeforeExit'),
      enabled: existingRuleTypes.includes('required_before_exit'),
      disabled: hasContinueLoop,
    });

    options.push({
      key: 'continue_loop',
      label: t('continueLoop'),
      enabled: hasContinueLoop,
      disabled:
        hasExitLoop || existingRuleTypes.includes('required_before_exit'),
    });

    options.push({
      key: 'run_first',
      label: t('runFirst'),
      enabled: existingRuleTypes.includes('run_first'),
    });

    return options;
  }, [existingRuleTypes, t]);

  function handleRuleToggle(
    ruleType: SupportedToolRuleNameTypes,
    isEnabled: boolean,
  ) {
    handleToggleRuleForTool(ruleType, toolName, isEnabled);
  }

  const { setSelectedToolId } = useToolManagerState();
  const agentState = useCurrentAgent();

  const currentToolId = useMemo(() => {
    return agentState?.tools?.find((tool) => tool.name === toolName)?.id || '';
  }, [agentState?.tools, toolName]);

  function handleViewAllRules() {
    openToolManager('/tool-rules');
  }

  if (!agent.id) {
    return null;
  }

  return (
    <HStack
      gap="small"
      align="center"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <DropdownMenu
        open={open}
        onOpenChange={setIsOpen}
        trigger={
          <Button
            _use_rarely_className={cn(!open ? 'text-muted' : '')}
            label={t('trigger', {
              toolName: toolName,
            })}
            preIcon={<RuleIcon size="auto" />}
            size="2xsmall"
            color="tertiary"
            hideLabel
            square
            tooltipPlacement="top"
          />
        }
        triggerAsChild
        align="start"
      >
        {allAvailableRules.map(({ key, label, enabled, disabled }) => (
          <DropdownMenuCheckboxItem
            key={key}
            label={label}
            checked={enabled}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                handleRuleToggle(key, enabled);
              }
            }}
          />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem label={t('view')} onClick={handleViewAllRules} />
      </DropdownMenu>
      {currentToolId && (
        <Button
          label={t('viewTool', {
            toolName: toolName,
          })}
          size="2xsmall"
          _use_rarely_className="text-muted"
          color="tertiary"
          preIcon={<ToolsIcon size="auto" />}
          onClick={() => {
            openToolManager(`/current-agent-tools`);
            setSelectedToolId(currentToolId);
          }}
          hideLabel
          square
        />
      )}
    </HStack>
  );
}

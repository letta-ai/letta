'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  HStack,
  toast,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../hooks';
import {
  useAgentsServiceModifyAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
  type AgentState,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { deepEquals } from 'nx/src/utils/json-diff';
import type {
  SupportedToolRuleTypes,
  SupportedToolRuleNameTypes,
  ToolRules,
} from './types';
import { ToolRulesSearchFilter } from './ToolRulesSearchFilter';
import { ToolRuleEditor } from './ToolRuleEditors';

// Add these type definitions at the top of the file
interface ToolRuleItem {
  rule: SupportedToolRuleTypes;
  index: number;
  isGrouped: boolean;
}

interface ToolGroup {
  toolName: string;
  rules: ToolRuleItem[];
}

// Add this CSS-in-JS styled component for the connections
function ConnectionLine({
  toolName,
  ruleIndex,
}: {
  toolName: string;
  ruleIndex: number;
}) {
  const [path, setPath] = React.useState<string>('');

  React.useEffect(() => {
    const sourceId = `handle-source-${toolName.replace(/\s+/g, '-')}`;
    const targetId = `handle-target-${toolName.replace(/\s+/g, '-')}-${ruleIndex}`;

    const sourceEl = document.getElementById(sourceId);
    const targetEl = document.getElementById(targetId);

    // Don't render if either element doesn't exist
    if (!sourceEl || !targetEl) {
      setPath('');
      return;
    }

    const sourceRect = sourceEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const container = sourceEl.closest('.tool-group-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    const startX = sourceRect.left - containerRect.left + sourceRect.width / 2;
    const startY = sourceRect.bottom - containerRect.top;
    const endX = targetRect.left - containerRect.left + targetRect.width / 2;
    const endY =
      targetRect.top - containerRect.top + targetRect.height / 2 - 10;

    // Step path - vertical down to child's Y level, then horizontal
    const pathData = `M ${startX} ${startY} L ${startX} ${endY} L ${endX} ${endY}`;

    setPath(pathData);
  }, [toolName, ruleIndex]);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <defs>
        <marker
          id={`arrowhead-${toolName}-${ruleIndex}`}
          markerWidth="6"
          markerHeight="4"
          refX="5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 6 2, 0 4" fill="hsl(var(--muted))" />
        </marker>
      </defs>
      <path
        d={path}
        // stroke="hsl(var(--muted))"
        stroke="hsl(var(--steel))"
        strokeWidth="1"
        fill="none"
        markerEnd={`url(#arrowhead-${toolName}-${ruleIndex})`}
      />
    </svg>
  );
}

// Main ToolRulesList Component
interface ToolRulesListProps {
  defaultToolRules: ToolRules;
}

export function ToolRulesList(props: ToolRulesListProps) {
  const { defaultToolRules } = props;
  const [search, setSearch] = React.useState('');
  const [filterBy, setFilterBy] = React.useState<
    | 'all'
    | 'constrain_child_tools'
    | 'continue_loop'
    | 'exit_loop'
    | 'max_count_per_step'
    | 'required_before_exit'
    | 'run_first'
  >('all');
  const [viewMode, setViewMode] = React.useState<'rules' | 'tools'>('rules');
  const currentAgent = useCurrentAgent();
  const { id: agentId } = currentAgent;
  const t = useTranslations('ADE/ToolRules');
  const [toolRules, setToolRules] = useState(() => {
    return Array.isArray(defaultToolRules) ? defaultToolRules : [];
  });

  const queryClient = useQueryClient();

  const { mutate } = useAgentsServiceModifyAgent({
    onError: () => {
      toast.error(t('ToolRuleList.error'));
      setToolRules(Array.isArray(defaultToolRules) ? defaultToolRules : []);
    },
    onSuccess: (data) => {
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

  const handleUpdateTools = useCallback(
    (nextTools: ToolRules) => {
      mutate({
        agentId,
        requestBody: {
          tool_rules: nextTools,
        },
      });
    },
    [agentId, mutate],
  );

  const filteredRules = useMemo(() => {
    // Filter out unsupported rule types first
    const supportedRules = toolRules.filter(
      (rule): rule is SupportedToolRuleTypes => {
        return (
          !!rule.type &&
          [
            'continue_loop',
            'exit_loop',
            'run_first',
            'constrain_child_tools',
            'conditional',
            'max_count_per_step',
            'required_before_exit',
          ].includes(rule.type)
        );
      },
    );

    if (viewMode === 'tools') {
      // Group by tool names, but only include tools with actual names
      const toolGroups = supportedRules.reduce(
        (acc, rule, index) => {
          const toolName = rule.tool_name;

          // Skip rules with empty or falsy tool names
          if (!toolName || toolName.trim() === '') {
            return acc;
          }

          if (!acc[toolName]) {
            acc[toolName] = [];
          }

          acc[toolName].push({ rule, index, isGrouped: false });
          return acc;
        },
        {} as Record<string, ToolRuleItem[]>,
      );

      // Only filter if there's a search term
      const filteredToolGroups =
        search === ''
          ? Object.entries(toolGroups)
          : Object.entries(toolGroups).filter(([toolName]) =>
              toolName.toLowerCase().includes(search.toLowerCase()),
            );

      return filteredToolGroups.map(
        ([toolName, rules]): ToolGroup => ({
          toolName,
          rules,
        }),
      );
    } else {
      // Original rules-based grouping logic
      const grouped = supportedRules.reduce((acc, rule, index) => {
        if (rule.type === 'continue_loop' || rule.type === 'exit_loop') {
          // For these types, always show as grouped - only keep the first occurrence in the UI
          if (!acc.find((item) => item.rule.type === rule.type)) {
            acc.push({ rule, index, isGrouped: true });
          }
        } else {
          // For other types, keep all rules
          acc.push({ rule, index, isGrouped: false });
        }

        return acc;
      }, [] as ToolRuleItem[]);

      // Filter based on search and rule type
      const filtered = grouped.filter(({ rule }) => {
        // Filter by type first
        const matchesType = filterBy === 'all' || rule.type === filterBy;

        // For empty tool names, only show if they match the filter type
        if (rule.tool_name === '') {
          return matchesType;
        }

        // Filter by search for non-empty tool names
        const matchesSearch = rule.tool_name
          .toLowerCase()
          .includes(search.toLowerCase());

        return matchesSearch && matchesType;
      });

      return filtered;
    }
  }, [search, toolRules, filterBy, viewMode]);

  const RULE_TEMPLATES = useMemo(
    (): Record<SupportedToolRuleNameTypes, SupportedToolRuleTypes> => ({
      constrain_child_tools: {
        type: 'constrain_child_tools',
        tool_name: '',
        children: [],
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

  const handleSelectRule = useCallback(
    (rule: SupportedToolRuleNameTypes) => {
      setToolRules((prev) => [...prev, RULE_TEMPLATES[rule]]);
    },
    [RULE_TEMPLATES],
  ); // Add RULE_TEMPLATES to dependency array

  const mounted = React.useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    if (deepEquals(toolRules, defaultToolRules)) {
      return;
    }

    handleUpdateTools(toolRules);
  }, [toolRules, defaultToolRules, handleUpdateTools]);

  const handleRemoveRule = useCallback((index: number) => {
    setToolRules((prev) => {
      const ruleToRemove = prev[index];

      // For continue_loop and exit_loop, remove all rules of the same type
      if (
        ruleToRemove.type === 'continue_loop' ||
        ruleToRemove.type === 'exit_loop'
      ) {
        return prev.filter((rule) => rule.type !== ruleToRemove.type);
      }

      // For other rule types, remove just the single rule
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSaveRule = useCallback(
    (
      index: number,
      rule: SupportedToolRuleTypes | SupportedToolRuleTypes[],
    ) => {
      setToolRules((prev) => {
        if (Array.isArray(rule)) {
          // Handle multiple rules (for continue_loop and exit_loop)
          const currentRule = prev[index];
          const ruleType = currentRule.type;

          // Find the position of the first rule of this type to maintain order
          const firstRuleIndex = prev.findIndex((r) => r.type === ruleType);

          // Create new array maintaining order
          const newRules = [...prev];

          // Remove all existing rules of the same type
          for (let i = newRules.length - 1; i >= 0; i--) {
            if (newRules[i].type === ruleType) {
              newRules.splice(i, 1);
            }
          }

          // Insert new rules at the original position of the first rule
          const insertPosition =
            firstRuleIndex >= 0
              ? Math.min(firstRuleIndex, newRules.length)
              : newRules.length;
          newRules.splice(insertPosition, 0, ...rule);

          return newRules;
        } else {
          // Handle single rule (existing behavior)
          return prev.map((item, i) => {
            if (i === index) {
              return rule;
            }
            return item;
          });
        }
      });
    },
    [],
  );

  function renderToolRuleEditor(rule: SupportedToolRuleTypes, index: number) {
    return (
      <ToolRuleEditor
        key={index}
        rule={rule}
        index={index}
        onRemove={() => {
          handleRemoveRule(index);
        }}
        onSubmit={(data) => {
          handleSaveRule(index, data);
        }}
        toolRules={toolRules}
        viewMode={viewMode}
      />
    );
  }

  return (
    <VStack
      gap={false}
      fullHeight
      overflowY="hidden"
      fullWidth
      color="background-grey"
    >
      <HStack
        align="center"
        paddingY="large"
        paddingX="large"
        borderBottom
        fullWidth
        color="background"
      >
        <ToolRulesSearchFilter
          searchValue={search}
          onSearchChange={setSearch}
          onAddRule={viewMode === 'rules' ? handleSelectRule : undefined}
          filterBy={filterBy}
          onFilterChange={setFilterBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </HStack>
      <VStack padding collapseHeight flex overflowY="auto">
        <VStack gap={viewMode === 'tools' ? 'xlarge' : 'small'}>
          {viewMode === 'tools'
            ? (filteredRules as ToolGroup[]).map(({ toolName, rules }) => (
                <VStack
                  key={toolName}
                  gap="medium"
                  align="start"
                  className="tool-group-container"
                  /* eslint-disable-next-line react/forbid-component-props */
                  style={{ position: 'relative' }}
                >
                  <div className="tool-name-item-hover">
                    <HStack
                      border
                      color="background"
                      /* eslint-disable-next-line react/forbid-component-props */
                      style={{ borderColor: 'hsl(var(--steel))' }}
                      padding="small"
                      className="relative h-full"
                    >
                      <Typography variant="body2" color="default" semibold>
                        {toolName}
                      </Typography>
                      {/* Bottom left handle for parent */}
                      <div
                        id={`handle-source-${toolName.replace(/\s+/g, '-')}`}
                        style={{
                          position: 'absolute',
                          left: '6.5px',
                          bottom: '-4px',
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: 'hsl(var(--steel))',
                          zIndex: 2,
                        }}
                      />
                    </HStack>
                  </div>

                  {/* Connection lines */}
                  {rules.map((_, index) => (
                    <ConnectionLine
                      key={`connection-${toolName}-${index}`}
                      toolName={toolName}
                      ruleIndex={index}
                    />
                  ))}

                  {/* eslint-disable-next-line react/forbid-component-props */}
                  <VStack gap="small" fullWidth className="pl-8">
                    {rules.map(({ rule, index }, ruleIndex) =>
                      rule.type ? (
                        <div
                          key={`${toolName}-${index}`}
                          style={{ position: 'relative' }}
                        >
                          {/* Center left handle for child */}
                          <div
                            id={`handle-target-${toolName.replace(/\s+/g, '-')}-${ruleIndex}`}
                            style={{
                              position: 'absolute',
                              left: '-11px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                            }}
                          />
                          {renderToolRuleEditor(rule, index)}
                        </div>
                      ) : null,
                    )}
                  </VStack>
                </VStack>
              ))
            : // Rules view - original logic
              (filteredRules as ToolRuleItem[]).map(({ rule, index }) =>
                renderToolRuleEditor(rule, index),
              )}
        </VStack>
      </VStack>
    </VStack>
  );
}

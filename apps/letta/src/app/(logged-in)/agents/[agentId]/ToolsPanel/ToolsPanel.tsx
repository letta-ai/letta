'use client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Panel,
  PanelBar,
  PanelHeader,
  PanelItem,
  ToggleCard,
  VStack,
} from '@letta-web/component-library';
import { NavigationItem } from '../common/ADENavigationItem/ADENavigationItem';
import { useCurrentAgent, useCurrentAgentId } from '../hooks';
import type { AgentState } from '@letta-web/letta-agents-api';
import {
  UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn,
  useAgentsServiceUpdateAgentApiAgentsAgentIdPost,
  useToolsServiceListAllToolsApiToolsGet,
} from '@letta-web/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';

function ToolsList() {
  const currentAgentId = useCurrentAgentId();
  const { tools: currentToolNames } = useCurrentAgent();
  const { data: allTools } = useToolsServiceListAllToolsApiToolsGet();

  const { mutate } = useAgentsServiceUpdateAgentApiAgentsAgentIdPost({
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
          agentId: currentAgentId,
        }),
      });

      const previousAgentState = queryClient.getQueryData<
        AgentState | undefined
      >(
        UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
          agentId: currentAgentId,
        })
      );

      queryClient.setQueryData<AgentState | undefined>(
        UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
          agentId: currentAgentId,
        }),
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            tools: variables.requestBody.tools || [],
          };
        }
      );

      return { previousAgentState };
    },
    onError: (a, b, context) => {
      if (context?.previousAgentState) {
        queryClient.setQueryData(
          UseAgentsServiceGetAgentStateApiAgentsAgentIdGetKeyFn({
            agentId: currentAgentId,
          }),
          context.previousAgentState
        );
      }
    },
  });
  const queryClient = useQueryClient();

  const handleToggleCardChange = useCallback(
    (toolName: string, checked: boolean) => {
      const newTools = checked
        ? [...currentToolNames, toolName]
        : currentToolNames.filter((name) => name !== toolName);

      mutate({
        agentId: currentAgentId,
        requestBody: {
          id: currentAgentId,
          tools: newTools,
        },
      });
    },
    [currentAgentId, currentToolNames, mutate, queryClient]
  );

  const currentToolsAsSet = useMemo(() => {
    return new Set(currentToolNames);
  }, [currentToolNames]);

  return (
    <PanelItem>
      <VStack fullWidth gap="small">
        {(allTools || []).map((tool) => {
          return (
            <ToggleCard
              key={tool.id}
              title={tool.name}
              checked={currentToolsAsSet.has(tool.name)}
              onChange={(checked) => {
                handleToggleCardChange(tool.name, checked);
              }}
            />
          );
        })}
      </VStack>
    </PanelItem>
  );
}

export function ToolsPanel() {
  const [search, setSearch] = useState('');

  return (
    <Panel
      width="compact"
      id={['sidebar', 'tools']}
      trigger={<NavigationItem title="Tools" />}
    >
      <PanelHeader title="Tools" />
      <PanelBar
        onSearch={(value) => {
          setSearch(value);
        }}
        searchValue={search}
        actions={
          <>
            {/*<Button size="small" color="tertiary" label="Import Tool" />*/}
            <Button size="small" color="secondary" label="Add Tool" />
          </>
        }
      />
      <ToolsList />
    </Panel>
  );
}

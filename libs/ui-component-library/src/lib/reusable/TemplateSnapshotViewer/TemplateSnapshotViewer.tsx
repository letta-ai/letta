'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { useTranslations } from '@letta-cloud/translations';
import type { TemplateSnapshotSchemaType } from '@letta-cloud/utils-shared';
import { JSONDiff } from '../../core/JSONDiff/JSONDiff';
import { JSONViewer } from '../../core/JSONViewer/JSONViewer';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { omit } from 'lodash-es';
import { type Tool, useToolsServiceListTools } from '@letta-cloud/sdk-core';

interface AgentStateViewerProps {
  baseState: TemplateSnapshotSchemaType;
  comparedState?: TemplateSnapshotSchemaType;
  baseName?: string;
  comparedName?: string;
}

// extract unique tool IDs from template snapshots
function extractUniqueToolIds(baseState: TemplateSnapshotSchemaType, comparedState?: TemplateSnapshotSchemaType): string[] {
  const toolIdSet = new Set<string>();

  if (baseState.type === 'classic') {
    baseState.agents.forEach(agent => {
      if (agent.toolIds) {
        agent.toolIds.forEach(id => toolIdSet.add(id));
      }
    });
  }

  if (comparedState && comparedState.type === 'classic') {
    comparedState.agents.forEach(agent => {
      if (agent.toolIds) {
        agent.toolIds.forEach(id => toolIdSet.add(id));
      }
    });
  }

  return Array.from(toolIdSet);
}

// omit any entityId from the state for comparison
function stateCleaner(state: TemplateSnapshotSchemaType, tools: Tool[]) {
  const toolIdToNameMap = tools.reduce((acc, tool) => {
    if (tool.id) {
      acc[tool.id] = tool.name || '';

    }
    return acc;
  }, {} as Record<string, string>);

  if (state.type === 'classic') {
    return {
      ...state,
      agents: state.agents.map((agent) => {
        return {
          ...omit(agent, ['entityId']),
          // sort all ids
          toolIds: (agent.toolIds || [])
            .toSorted((a, b) => {
              if (a < b) return -1;
              if (a > b) return 1;
              return 0;
            })
            .map((id) =>
              toolIdToNameMap[id] ? `${id} (${toolIdToNameMap[id]})` : id,
            ),
          sourceIds: (agent.sourceIds || []).toSorted((a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
          }),
        };
      }),
      // sort by label
      blocks: state.blocks
        .map((block) => omit(block, ['entityId']))
        .toSorted((a, b) => {
          if ((a.label || '') < (b.label || '')) return -1;
          if ((a.label || '') > (b.label || '')) return 1;
          return 0;
        }),
    };
  }

  return state;
}

export function TemplateSnapshotViewer(props: AgentStateViewerProps) {
  const { baseState, comparedState, baseName, comparedName } = props;

  const t = useTranslations('components/TemplateSnapshotViewer.StateViewer');

  // Extract unique tool IDs from both states to optimize API call
  const uniqueToolIds = React.useMemo(() => {
    return extractUniqueToolIds(baseState, comparedState);
  }, [baseState, comparedState]);

  // Only fetch tools that are actually used in the snapshots
  const { data: toolsList } = useToolsServiceListTools({
    toolIds: uniqueToolIds.length > 0 ? uniqueToolIds : undefined,
    limit: uniqueToolIds.length > 0 ? uniqueToolIds.length : undefined,
  }, undefined, {
    enabled: uniqueToolIds.length > 0,
  });

  if (!comparedState) {
    return (
      <VStack
        className="w-fit min-w-full"
        color="background"
        padding="small"
        overflowX="auto"
        gap={false}
      >
        <JSONViewer data={baseState} />
      </VStack>
    );
  }

  // set next version
  comparedState.version = `${parseInt(baseState.version, 10) + 1}`;

  return (
    <VStack border className="w-fit min-w-full" overflowX="auto" gap={false}>
      <HStack borderBottom>
        <HStack padding="small" borderRight fullWidth>
          <Typography variant="body3" bold>
            {baseName || t('base')}
          </Typography>
        </HStack>
        <HStack padding="small" fullWidth>
          <Typography variant="body3" bold>
            {comparedName || t('compared')}
          </Typography>
        </HStack>
      </HStack>
      <JSONDiff
        showLineNumbers
        hideUnchangedLines
        currentState={stateCleaner(baseState, toolsList || [])}
        nextState={stateCleaner(comparedState, toolsList || [])}
      />
    </VStack>
  );
}

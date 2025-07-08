'use client';
import * as React from 'react';
import type { AgentState, Source, Tool } from '@letta-cloud/sdk-core';
import { VStack } from '../../framing/VStack/VStack';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import { stateCleaner } from '@letta-cloud/utils-shared';
import type { CleanedAgentState } from '@letta-cloud/utils-shared';
import { JSONDiff } from '../../core/JSONDiff/JSONDiff';
import { JSONViewer } from '../../core/JSONViewer/JSONViewer';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';

interface StateViewerProps {
  tools: Record<string, Tool>;
  sources: Record<string, Source>;
  state: CleanedAgentState;
  toCompare?: CleanedAgentState;
  baseName?: string;
  comparedName?: string;
}

// remove toolids replace with tools
// remove sourceIds replace with sources
function stateEnhancer(
  state: CleanedAgentState,
  tools: Record<string, Tool>,
  sources: Record<string, Source>,
) {
  const { toolIds, sourceIds, ...rest } = state;
  return {
    ...rest,
    tools: toolIds.map((toolId) => tools[toolId]),
    sources: sourceIds.map((sourceId) => sources[sourceId]),
  };
}

function StateViewer(props: StateViewerProps) {
  const { state, toCompare, tools, sources, comparedName, baseName } = props;

  const t = useTranslations('components/AgentStateViewer.StateViewer');

  const enhancedState = useMemo(() => {
    return stateEnhancer(state, tools, sources);
  }, [state, tools, sources]);

  const enhancedToCompare = useMemo(() => {
    return toCompare ? stateEnhancer(toCompare, tools, sources) : undefined;
  }, [toCompare, tools, sources]);

  if (!toCompare) {
    return (
      <VStack
        className="w-fit min-w-full"
        color="background"
        padding="small"
        overflowX="auto"
        gap={false}
      >
        <JSONViewer data={enhancedState} />
      </VStack>
    );
  }

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
        currentState={enhancedState}
        nextState={enhancedToCompare}
      />
    </VStack>
  );
}

interface AgentStateViewerProps {
  baseState: AgentState;
  comparedState?: AgentState;
  baseName?: string;
  comparedName?: string;
}

export function AgentStateViewer(props: AgentStateViewerProps) {
  const { baseState, comparedState, baseName, comparedName } = props;

  const { tools, sources } = useMemo(() => {
    const toolsMap: Record<string, Tool> = {};

    const sourcesMap: Record<string, Source> = {};

    (baseState.tools || []).forEach((tool) => {
      if (!tool.id) {
        return;
      }
      toolsMap[tool.id] = tool;
    });

    if (comparedState) {
      (comparedState.tools || []).forEach((tool) => {
        if (!tool.id) {
          return;
        }
        toolsMap[tool.id] = tool;
      });
    }

    (baseState.sources || []).forEach((source) => {
      if (!source.id) {
        return;
      }
      sourcesMap[source.id] = source;
    });

    if (comparedState) {
      (comparedState.sources || []).forEach((source) => {
        if (!source.id) {
          return;
        }
        sourcesMap[source.id] = source;
      });
    }

    return {
      tools: toolsMap,
      sources: sourcesMap,
    };
  }, [baseState, comparedState]);

  const cleanedBaseState = useMemo(() => stateCleaner(baseState), [baseState]);
  const cleanedComparedState = useMemo(
    () => (comparedState ? stateCleaner(comparedState) : undefined),
    [comparedState],
  );

  return (
    <StateViewer
      state={cleanedBaseState}
      toCompare={cleanedComparedState}
      tools={tools}
      sources={sources}
      baseName={baseName}
      comparedName={comparedName || ''}
    />
  );
}

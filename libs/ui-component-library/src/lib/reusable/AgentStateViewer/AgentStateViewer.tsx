'use client';
import * as React from 'react';
import type { AgentState, Source, Tool } from '@letta-cloud/sdk-core';
import { VStack } from '../../framing/VStack/VStack';
import { useTranslations } from '@letta-cloud/translations';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { cn } from '@letta-cloud/ui-styles';
import { useEffect, useMemo } from 'react';
import { stateCleaner } from '@letta-cloud/utils-shared';
import type { CleanedAgentState } from '@letta-cloud/utils-shared';

interface AgentStateViewerProps {
  baseState: AgentState;
  comparedState?: AgentState;
}

interface GetChangeClassProps {
  isAdditive: boolean;
  isChanged: boolean;
}

function getChangeClass({ isAdditive, isChanged }: GetChangeClassProps) {
  if (!isAdditive) {
    return isChanged
      ? 'bg-background-destructive text-background-destructive-content'
      : '';
  } else {
    return isChanged
      ? 'bg-background-success text-background-success-content'
      : '';
  }
}

interface InlineTextDiffProps {
  text: string;
  comparedText?: string;
}

function InlineTextDiff(props: InlineTextDiffProps) {
  const { text, comparedText } = props;
  const textArray = text.split('');

  const { isAdditive } = useSingleStateViewerContext();
  const comparedTextArray = comparedText?.split('');

  if (!comparedTextArray) {
    return text;
  }

  const diff = textArray.map((char, index) => {
    const comparedChar = comparedTextArray[index];

    if (char === comparedChar) {
      return <span key={index}>{char}</span>;
    }

    return (
      <span
        key={index}
        className={cn(
          getChangeClass({
            isAdditive,
            isChanged: true,
          }),
        )}
      >
        {char}
      </span>
    );
  });

  return diff;
}

interface ToolVariableViewerProps {
  toolVariables: CleanedAgentState['tool_exec_environment_variables'];
  comparedVariables?: CleanedAgentState['tool_exec_environment_variables'];
}

function ToolVariableViewer(props: ToolVariableViewerProps) {
  const t = useTranslations('components/AgentStateViewer');

  const { isAdditive } = useSingleStateViewerContext();
  const { toolVariables, comparedVariables } = props;

  if (!toolVariables || toolVariables.length === 0) {
    return (
      <Typography variant="body2">
        {t('ToolVariableViewer.noToolVariables')}
      </Typography>
    );
  }

  return (
    <table>
      <tbody>
        {toolVariables.map((variable) => {
          const comparedValue = comparedVariables?.find(
            (v) => v.key === variable.key,
          );

          return (
            <tr
              className={cn(
                getChangeClass({
                  isAdditive,
                  isChanged: !comparedValue,
                }),
              )}
              key={variable.key}
            >
              <td className="p-1">
                <Typography variant="body2">{variable.key}</Typography>
              </td>
              <td className="p1">
                <Typography variant="body2">
                  <InlineTextDiff
                    text={variable.value}
                    comparedText={comparedValue?.value}
                  />
                </Typography>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface SectionWrapperProps {
  title: string;
  children: React.ReactNode;
  id: string;
}

function SectionWrapper(props: React.PropsWithChildren<SectionWrapperProps>) {
  const { id } = props;

  const { id: baseId } = useSingleStateViewerContext();

  useEffect(() => {
    // compare base and compared id heights, and set the height of the shorter one to the height of the taller one

    const base = document.getElementById(`base-${id}`);
    const compared = document.getElementById(`compared-${id}`);

    if (!base || !compared) {
      return;
    }

    const baseHeight = base.clientHeight;

    const comparedHeight = compared.clientHeight;

    if (baseHeight > comparedHeight) {
      compared.style.height = `${baseHeight}px`;
    } else {
      base.style.height = `${comparedHeight}px`;
    }
  }, [id]);

  return (
    <VStack id={`${baseId}-${id}`} gap={false}>
      <VStack color="brand-light" padding="xsmall">
        <Typography variant="body2" bold>
          {props.title}
        </Typography>
      </VStack>
      <VStack padding="xsmall">{props.children}</VStack>
    </VStack>
  );
}

interface MemoryBlockViewerProps {
  memoryBlocks: CleanedAgentState['memoryBlocks'];
  comparedMemoryBlocks?: CleanedAgentState['memoryBlocks'];
}

function MemoryBlockViewer(props: MemoryBlockViewerProps) {
  const t = useTranslations('components/AgentStateViewer');
  const { isAdditive } = useSingleStateViewerContext();
  const { memoryBlocks, comparedMemoryBlocks } = props;

  if (!memoryBlocks) {
    return <>{t('MemoryBlockViewer.noMemoryBlocks')}</>;
  }

  return (
    <VStack gap={false}>
      {memoryBlocks.map((block) => {
        const comparedBlock = comparedMemoryBlocks?.find(
          (b) => b.label === block.label,
        );

        return (
          <VStack
            padding="small"
            className={cn(
              getChangeClass({
                isAdditive,
                isChanged: !comparedBlock,
              }),
            )}
            key={block.label || ''}
          >
            <HStack>
              <Typography bold variant="body2">
                {block.label || ''}
              </Typography>
              <Typography variant="body2" color="muted">
                {t.rich('MemoryBlockViewer.limit', {
                  limit: () => (
                    <InlineTextDiff
                      text={block.limit.toString()}
                      comparedText={comparedBlock?.limit.toString()}
                    />
                  ),
                })}
              </Typography>
            </HStack>
            <VStack className="p1">
              <Typography variant="body2">
                <InlineTextDiff
                  text={block.value}
                  comparedText={comparedBlock?.value}
                />
              </Typography>
            </VStack>
          </VStack>
        );
      })}
    </VStack>
  );
}

interface KeyValueDiffViewerProps {
  keyValuePairs: Record<string, any>;
  comparedKeyValuePairs?: Record<string, any>;
}

function KeyValueDiffViewer(props: KeyValueDiffViewerProps) {
  const { keyValuePairs, comparedKeyValuePairs } = props;
  const { isAdditive } = useSingleStateViewerContext();

  return (
    <table>
      <tbody>
        {Object.entries(keyValuePairs).map(([key, value]) => {
          const parsedValue = JSON.stringify(value);
          const parsedComparedValue = JSON.stringify(
            comparedKeyValuePairs?.[key],
          );

          return (
            <tr
              className={cn(
                getChangeClass({
                  isAdditive,
                  isChanged: parsedValue !== parsedComparedValue,
                }),
              )}
              key={key}
            >
              <td className="p-1 ">
                <Typography variant="body2">{key}</Typography>
              </td>
              <td className="p1">
                <Typography variant="body2">
                  <InlineTextDiff
                    text={parsedValue}
                    comparedText={parsedComparedValue}
                  />
                </Typography>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface ToolsViewerProps {
  toolIds: CleanedAgentState['toolIds'];
  comparedToolIds?: CleanedAgentState['toolIds'];
}

function ToolsViewer(props: ToolsViewerProps) {
  const { toolIds, comparedToolIds } = props;
  const { isAdditive, tools } = useSingleStateViewerContext();

  return (
    <VStack gap={false}>
      {toolIds.map((toolId) => {
        const tool = tools[toolId];
        const comparedTool = comparedToolIds?.find((t) => t === toolId);

        return (
          <VStack
            gap={false}
            key={toolId}
            className={cn(
              getChangeClass({
                isAdditive,
                isChanged: !comparedTool,
              }),
              'p-3',
            )}
            align="start"
            fullWidth
          >
            <Typography bold variant="body2">
              {tool.name}
            </Typography>
            <Typography
              className="line-clamp-3 overflow-hidden"
              variant="body2"
              color="lighter"
            >
              {tool.description}
            </Typography>
          </VStack>
        );
      })}
    </VStack>
  );
}

interface SourceViewerProps {
  sourceIds: CleanedAgentState['sourceIds'];
  comparedSourceIds?: CleanedAgentState['sourceIds'];
}

function SourceViewer(props: SourceViewerProps) {
  const { sourceIds, comparedSourceIds } = props;
  const { isAdditive, sources } = useSingleStateViewerContext();
  const t = useTranslations('components/AgentStateViewer');

  if (!sourceIds || sourceIds.length === 0) {
    return (
      <Typography variant="body2">{t('SourceViewer.noSources')}</Typography>
    );
  }

  return (
    <VStack gap={false}>
      {sourceIds.map((sourceId) => {
        const source = sources[sourceId];
        const comparedSource = comparedSourceIds?.find((s) => s === sourceId);

        return (
          <VStack
            gap={false}
            key={sourceId}
            className={cn(
              getChangeClass({
                isAdditive,
                isChanged: !comparedSource,
              }),
              'p-3',
            )}
            align="start"
            fullWidth
          >
            <Typography bold variant="body2">
              {source.name}
            </Typography>
            <Typography
              className="line-clamp-3 overflow-hidden"
              variant="body2"
              color="lighter"
            >
              {source.description}
            </Typography>
          </VStack>
        );
      })}
    </VStack>
  );
}

interface SingleStateViewerProps {
  tools: Record<string, Tool>;
  sources: Record<string, Source>;
  state: CleanedAgentState;
  toCompare?: CleanedAgentState;
  isAdditive?: boolean;
  id: string;
}

interface SingleStateViewerContextData {
  tools: Record<string, Tool>;
  sources: Record<string, Source>;
  isAdditive: boolean;
  id: string;
}

const SingleStateViewerContext = React.createContext<
  SingleStateViewerContextData | undefined
>(undefined);

function useSingleStateViewerContext() {
  const context = React.useContext(SingleStateViewerContext);
  if (context === undefined) {
    throw new Error(
      'useSingleStateViewerContext must be used within a SingleStateViewer',
    );
  }
  return context;
}

function SingleStateViewer(props: SingleStateViewerProps) {
  const { state, toCompare, id, isAdditive = false, tools, sources } = props;

  const t = useTranslations('components/AgentStateViewer');
  return (
    <SingleStateViewerContext.Provider
      value={{ tools, id, sources, isAdditive }}
    >
      <VStack fullWidth gap={false}>
        <SectionWrapper id="memory-block" title={t('MemoryBlockViewer.title')}>
          <MemoryBlockViewer
            memoryBlocks={state.memoryBlocks}
            comparedMemoryBlocks={toCompare?.memoryBlocks}
          />
        </SectionWrapper>
        <SectionWrapper id="llm-config" title={t('LLMConfig.title')}>
          <KeyValueDiffViewer
            keyValuePairs={state.llmConfig}
            comparedKeyValuePairs={toCompare?.llmConfig}
          />
        </SectionWrapper>
        <SectionWrapper
          id="embedding-config"
          title={t('EmbeddingConfig.title')}
        >
          <KeyValueDiffViewer
            keyValuePairs={state.embedding_config}
            comparedKeyValuePairs={toCompare?.embedding_config}
          />
        </SectionWrapper>
        <SectionWrapper id="tool-ids" title={t('ToolsViewer.title')}>
          <ToolsViewer
            toolIds={state.toolIds}
            comparedToolIds={toCompare?.toolIds}
          />
        </SectionWrapper>
        <SectionWrapper
          id="tool-variables"
          title={t('ToolVariableViewer.toolVariables')}
        >
          <ToolVariableViewer
            toolVariables={state.tool_exec_environment_variables}
            comparedVariables={toCompare?.tool_exec_environment_variables}
          />
        </SectionWrapper>
        <SectionWrapper id="source-ids" title={t('SourceViewer.title')}>
          <SourceViewer
            sourceIds={state.sourceIds}
            comparedSourceIds={toCompare?.sourceIds}
          />
        </SectionWrapper>
        <SectionWrapper id="prompt-template" title={t('PromptTemplate.title')}>
          <HStack className="p-1">
            <Typography variant="body2">
              <InlineTextDiff
                text={state.promptTemplate}
                comparedText={toCompare?.promptTemplate}
              />
            </Typography>
          </HStack>
        </SectionWrapper>
        <SectionWrapper id="system-prompt" title={t('SystemPrompt.title')}>
          <HStack className="p-1">
            <Typography variant="body2">
              <InlineTextDiff
                text={state.system}
                comparedText={toCompare?.system}
              />
            </Typography>
          </HStack>
        </SectionWrapper>
      </VStack>
    </SingleStateViewerContext.Provider>
  );
}

export function AgentStateViewer(props: AgentStateViewerProps) {
  const { baseState, comparedState } = props;

  const { tools, sources } = useMemo(() => {
    const toolsMap: Record<string, Tool> = {};

    const sourcesMap: Record<string, Source> = {};

    baseState.tools.forEach((tool) => {
      if (!tool.id) {
        return;
      }
      toolsMap[tool.id] = tool;
    });

    if (comparedState) {
      comparedState.tools.forEach((tool) => {
        if (!tool.id) {
          return;
        }
        toolsMap[tool.id] = tool;
      });
    }

    baseState.sources.forEach((source) => {
      if (!source.id) {
        return;
      }
      sourcesMap[source.id] = source;
    });

    if (comparedState) {
      comparedState.sources.forEach((source) => {
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
    <HStack gap={false}>
      <VStack gap={false} fullWidth borderRight={!!cleanedComparedState}>
        <SingleStateViewer
          id="base"
          state={cleanedBaseState}
          toCompare={cleanedComparedState}
          tools={tools}
          sources={sources}
        />
      </VStack>
      {cleanedComparedState && (
        <VStack gap={false} fullWidth>
          <SingleStateViewer
            id="compared"
            isAdditive
            state={cleanedComparedState}
            toCompare={cleanedBaseState}
            tools={tools}
            sources={sources}
          />
        </VStack>
      )}
    </HStack>
  );
}

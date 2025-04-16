'use client';
import * as React from 'react';
import type { AgentState, Source, Tool } from '@letta-cloud/sdk-core';
import { VStack } from '../../framing/VStack/VStack';
import { useTranslations } from '@letta-cloud/translations';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { cn } from '@letta-cloud/ui-styles';
import { useCallback, useMemo, useState } from 'react';
import { stateCleaner } from '@letta-cloud/utils-shared';
import type { CleanedAgentState } from '@letta-cloud/utils-shared';
import { diffWords } from 'diff';
import { ChevronDownIcon, ChevronUpIcon } from '../../icons';
import { isEqual } from 'lodash';
import { Alert } from '../../core/Alert/Alert';
import { Badge } from '../../core/Badge/Badge';
import { InlineTextDiff } from '../../core/InlineTextDiff/InlineTextDiff';

interface AgentStateViewerProps {
  baseState: AgentState;
  comparedState?: AgentState;
  baseName?: string;
  comparedName?: string;
}

interface GetChangeClassProps {
  isChanged: boolean;
  isAdditive?: boolean;
}

function getChangeClass({ isChanged, isAdditive }: GetChangeClassProps) {
  if (isAdditive) {
    return isChanged
      ? 'bg-destructive-diff line-through text-destructive-diff-content'
      : '';
  }

  return isChanged
    ? 'bg-background-success text-background-success-content'
    : '';
}

interface ToolVariableViewerProps {
  toolVariables: CleanedAgentState['tool_exec_environment_variables'];
  comparedVariables?: CleanedAgentState['tool_exec_environment_variables'];
}

function ToolVariableViewer(props: ToolVariableViewerProps) {
  const t = useTranslations('components/AgentStateViewer');

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
                  isChanged: !comparedValue,
                }),
              )}
              key={variable.key}
            >
              <td className="p-2">
                <Typography variant="body2">{variable.key}</Typography>
              </td>
              <td className="p-2">
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

interface SectionWrapperHeaderProps {
  title: string;
  isOpen: boolean;
  showIcon?: boolean;
  hasDifference?: boolean;
  onToggle: () => void;
}

function SectionWrapperHeader(props: SectionWrapperHeaderProps) {
  const { title, isOpen, hasDifference, showIcon, onToggle } = props;

  const t = useTranslations('components/AgentStateViewer');

  return (
    <HStack
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      borderY
      type="button"
      as="button"
      fullWidth
      justify="spaceBetween"
      color="background-grey"
      padding="xsmall"
    >
      <HStack align="center">
        <Typography variant="body" bold>
          {title}
        </Typography>
        {hasDifference && (
          <Badge content={t('changed')} variant="info" size="small" />
        )}
      </HStack>
      {showIcon ? (
        <>{isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}</>
      ) : null}
    </HStack>
  );
}

interface SectionWrapperProps {
  title: string;
  hasDifference?: boolean;
  base: React.ReactNode;
  compared?: React.ReactNode;
}

function SectionWrapper(props: React.PropsWithChildren<SectionWrapperProps>) {
  const { title, base, hasDifference, compared } = props;
  const [open, setOpen] = useState<boolean>(!!hasDifference || !compared);

  const handleToggle = useCallback(() => {
    setOpen(!open);
  }, [open]);

  return (
    <VStack fullWidth gap={false}>
      <HStack fullWidth gap={false}>
        <VStack gap={false} fullWidth>
          <SectionWrapperHeader
            showIcon={!compared}
            title={title}
            isOpen={open}
            onToggle={handleToggle}
          />
          <VStack fullWidth>{open && base}</VStack>
        </VStack>
        {compared && (
          <VStack gap={false} fullWidth borderLeft>
            <SectionWrapperHeader
              hasDifference={hasDifference}
              title={title}
              showIcon
              isOpen={open}
              onToggle={handleToggle}
            />
            {open && <VStack fullHeight>{compared}</VStack>}
          </VStack>
        )}
      </HStack>
    </VStack>
  );
}

interface ToolRuleViewerProps {
  toolRules: AgentState['tool_rules'];
  comparedToolRules?: AgentState['tool_rules'];
}

function ToolRuleViewer(props: ToolRuleViewerProps) {
  const { toolRules = [], comparedToolRules = [] } = props;
  const t = useTranslations('components/AgentStateViewer');

  const maxRules = Math.max(
    toolRules?.length || 0,
    comparedToolRules?.length || 0,
  );

  return (
    <VStack gap={false}>
      {new Array(maxRules).fill(0).map((_, index) => {
        const comparedRule = comparedToolRules?.[index];
        const rule = toolRules?.[index];
        return (
          <VStack borderBottom gap={false} key={index} fullWidth>
            <HStack align="center" padding="small">
              <Typography bold variant="body3">
                {t('ToolRuleViewer.rule', { index: index + 1 })}
              </Typography>
            </HStack>
            <VStack paddingTop={false} paddingX="small" paddingBottom="small">
              <VStack border>
                <KeyValueDiffViewer
                  keyValuePairs={rule || {}}
                  comparedKeyValuePairs={comparedRule}
                />
              </VStack>
            </VStack>
          </VStack>
        );
      })}
    </VStack>
  );
}

interface MemoryBlockViewerProps {
  memoryBlocks: CleanedAgentState['memoryBlocks'];
  comparedMemoryBlocks?: CleanedAgentState['memoryBlocks'];
}

function MemoryBlockViewer(props: MemoryBlockViewerProps) {
  const t = useTranslations('components/AgentStateViewer');
  const { memoryBlocks, comparedMemoryBlocks } = props;

  if (!memoryBlocks || memoryBlocks.length === 0) {
    return (
      <Typography variant="body3">
        {t('MemoryBlockViewer.noMemoryBlocks')}
      </Typography>
    );
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
              comparedBlock &&
                getChangeClass({
                  isChanged: !comparedBlock,
                }),
            )}
            key={block.label || ''}
          >
            <HStack>
              <Typography bold variant="body">
                {block.label || ''}
              </Typography>
              <Typography variant="body" color="muted">
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
              <span
                className="text-base
               leading-7 "
              >
                <span className="bg-background-grey p-[1px] border border-background-grey2">
                  <InlineTextDiff
                    text={block.value}
                    comparedText={comparedBlock?.value}
                  />
                </span>
              </span>
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

  const keyValueEntries = Object.entries(keyValuePairs);
  const comparedKeyValueEntries = Object.entries(comparedKeyValuePairs || {});

  const allKeys = new Set([
    ...keyValueEntries.map(([key]) => key),
    ...comparedKeyValueEntries.map(([key]) => key),
  ]);

  return (
    <table>
      <tbody>
        {Array.from(allKeys).map((key, index) => {
          const value = keyValuePairs[key];
          const comparedValue = comparedKeyValuePairs?.[key];
          const parsedValue = value ? JSON.stringify(value) : '';
          const parsedComparedValue = comparedValue
            ? JSON.stringify(comparedValue)
            : '';

          return (
            <tr
              className={cn(
                index % 2 === 1 ? 'bg-background-grey' : '',
                comparedKeyValuePairs && parsedValue !== parsedComparedValue
                  ? 'bg-background-grey2'
                  : '',
              )}
              key={key}
            >
              <td className="p-2 ">
                <Typography variant="body">{key}</Typography>
              </td>
              <td className="p-2">
                <Typography variant="body">
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
  const { tools } = useSingleStateViewerContext();

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
              comparedTool
                ? getChangeClass({
                    isChanged: !comparedTool,
                  })
                : null,
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
  const { sources } = useSingleStateViewerContext();
  const t = useTranslations('components/AgentStateViewer');

  if (!sourceIds || sourceIds.length === 0) {
    return <VStack padding="xsmall">{t('SourceViewer.noSources')}</VStack>;
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

interface StateViewerProps {
  tools: Record<string, Tool>;
  sources: Record<string, Source>;
  state: CleanedAgentState;
  toCompare?: CleanedAgentState;
  baseName?: string;
  comparedName?: string;
}

interface SingleStateViewerContextData {
  tools: Record<string, Tool>;
  sources: Record<string, Source>;
}

const SingleStateViewerContext = React.createContext<
  SingleStateViewerContextData | undefined
>(undefined);

function useSingleStateViewerContext() {
  const context = React.useContext(SingleStateViewerContext);
  if (context === undefined) {
    throw new Error(
      'useSingleStateViewerContext must be used within a StateViewer',
    );
  }
  return context;
}

interface GenericCompareProps {
  children: React.ReactNode;
}

function GenericCompare({ children }: GenericCompareProps) {
  return (
    <VStack padding="xsmall">
      <span className="text-base leading-7 ">
        <span className="bg-background-grey p-[1px] border border-background-grey2">
          {children}
        </span>
      </span>
    </VStack>
  );
}

function StateViewer(props: StateViewerProps) {
  const { state, toCompare, tools, comparedName, baseName, sources } = props;

  const t = useTranslations('components/AgentStateViewer');

  const hasMemoryBlocksDifference = useMemo(() => {
    return (
      toCompare?.memoryBlocks &&
      !isEqual(state.memoryBlocks, toCompare.memoryBlocks)
    );
  }, [state.memoryBlocks, toCompare?.memoryBlocks]);

  const hasLLMConfigDifference = useMemo(() => {
    return (
      toCompare?.llmConfig && !isEqual(state.llmConfig, toCompare.llmConfig)
    );
  }, [state.llmConfig, toCompare?.llmConfig]);

  const hasEmbeddingConfigDifference = useMemo(() => {
    return (
      toCompare?.embedding_config &&
      !isEqual(state.embedding_config, toCompare.embedding_config)
    );
  }, [state.embedding_config, toCompare?.embedding_config]);

  const hasToolIdsDifference = useMemo(() => {
    return toCompare?.toolIds && !isEqual(state.toolIds, toCompare.toolIds);
  }, [state.toolIds, toCompare?.toolIds]);

  const hasSourceIdsDifference = useMemo(() => {
    return (
      toCompare?.sourceIds && !isEqual(state.sourceIds, toCompare.sourceIds)
    );
  }, [state.sourceIds, toCompare?.sourceIds]);

  const hasPromptTemplateDifference = useMemo(() => {
    return toCompare?.promptTemplate
      ? !isEqual(state.promptTemplate, toCompare.promptTemplate)
      : false;
  }, [state.promptTemplate, toCompare?.promptTemplate]);

  const hasSystemDifference = useMemo(() => {
    return toCompare?.system ? state.system !== toCompare.system : false;
  }, [state.system, toCompare?.system]);

  const hasToolVariablesDifference = useMemo(() => {
    return (
      toCompare?.tool_exec_environment_variables &&
      !isEqual(
        state.tool_exec_environment_variables,
        toCompare.tool_exec_environment_variables,
      )
    );
  }, [
    state.tool_exec_environment_variables,
    toCompare?.tool_exec_environment_variables,
  ]);

  const hasToolRulesDifference = useMemo(() => {
    return (
      toCompare?.toolRules && !isEqual(state.toolRules, toCompare.toolRules)
    );
  }, [state.toolRules, toCompare?.toolRules]);

  const hasNoDifference = useMemo(() => {
    return (
      !hasMemoryBlocksDifference &&
      !hasLLMConfigDifference &&
      !hasEmbeddingConfigDifference &&
      !hasToolIdsDifference &&
      !hasSourceIdsDifference &&
      !hasPromptTemplateDifference &&
      !hasToolVariablesDifference &&
      !hasSystemDifference &&
      !!toCompare &&
      !hasToolRulesDifference
    );
  }, [
    hasMemoryBlocksDifference,
    hasLLMConfigDifference,
    hasEmbeddingConfigDifference,
    hasToolIdsDifference,
    hasToolVariablesDifference,
    hasSourceIdsDifference,
    hasPromptTemplateDifference,
    hasSystemDifference,
    hasToolRulesDifference,
    toCompare,
  ]);

  return (
    <SingleStateViewerContext.Provider value={{ tools, sources }}>
      {hasNoDifference && <Alert title={t('noDifference')} variant="info" />}
      <VStack border className="w-fit min-w-full" overflowX="auto" gap={false}>
        <HStack fullWidth gap={false}>
          {baseName && <StateHeader name={baseName} />}
          {toCompare && (
            <StateHeader name={comparedName || t('StateViewer.compared')} />
          )}
        </HStack>
        <SectionWrapper
          hasDifference={hasMemoryBlocksDifference}
          title={t('MemoryBlockViewer.title')}
          base={<MemoryBlockViewer memoryBlocks={state.memoryBlocks} />}
          compared={
            toCompare && (
              <MemoryBlockViewer
                memoryBlocks={state.memoryBlocks}
                comparedMemoryBlocks={toCompare?.memoryBlocks}
              />
            )
          }
        ></SectionWrapper>
        <SectionWrapper
          hasDifference={hasLLMConfigDifference}
          base={<KeyValueDiffViewer keyValuePairs={state.llmConfig || {}} />}
          compared={
            toCompare && (
              <KeyValueDiffViewer
                keyValuePairs={state.llmConfig || {}}
                comparedKeyValuePairs={toCompare?.llmConfig}
              />
            )
          }
          title={t('LLMConfig.title')}
        ></SectionWrapper>
        <SectionWrapper
          hasDifference={hasEmbeddingConfigDifference}
          base={
            <KeyValueDiffViewer keyValuePairs={state.embedding_config || {}} />
          }
          compared={
            toCompare && (
              <KeyValueDiffViewer
                keyValuePairs={state.embedding_config || {}}
                comparedKeyValuePairs={toCompare?.embedding_config}
              />
            )
          }
          title={t('EmbeddingConfig.title')}
        ></SectionWrapper>
        <SectionWrapper
          hasDifference={hasToolIdsDifference}
          base={<ToolsViewer toolIds={state.toolIds} />}
          compared={
            toCompare && (
              <ToolsViewer
                toolIds={state.toolIds}
                comparedToolIds={toCompare?.toolIds}
              />
            )
          }
          title={t('ToolsViewer.title')}
        ></SectionWrapper>
        <SectionWrapper
          hasDifference={hasSourceIdsDifference}
          base={<SourceViewer sourceIds={state.sourceIds} />}
          compared={
            toCompare && (
              <SourceViewer
                sourceIds={state.sourceIds}
                comparedSourceIds={toCompare?.sourceIds}
              />
            )
          }
          title={t('SourceViewer.title')}
        ></SectionWrapper>
        <SectionWrapper
          hasDifference={hasPromptTemplateDifference}
          base={
            <GenericCompare>
              <InlineTextDiff text={state.promptTemplate} />
            </GenericCompare>
          }
          compared={
            toCompare && (
              <GenericCompare>
                <InlineTextDiff
                  text={state.promptTemplate}
                  comparedText={toCompare?.promptTemplate}
                />
              </GenericCompare>
            )
          }
          title={t('PromptTemplate.title')}
        ></SectionWrapper>

        <SectionWrapper
          hasDifference={hasSystemDifference}
          base={
            <GenericCompare>
              <InlineTextDiff text={state.system} />
            </GenericCompare>
          }
          compared={
            toCompare && (
              <GenericCompare>
                <InlineTextDiff
                  text={state.system}
                  comparedText={toCompare?.system}
                />
              </GenericCompare>
            )
          }
          title={t('SystemPrompt.title')}
        ></SectionWrapper>
        <SectionWrapper
          hasDifference={!!hasToolRulesDifference}
          base={<ToolRuleViewer toolRules={state.toolRules} />}
          compared={
            toCompare && (
              <ToolRuleViewer
                toolRules={state.toolRules}
                comparedToolRules={toCompare?.toolRules}
              />
            )
          }
          title={t('ToolRuleViewer.title')}
        ></SectionWrapper>
        <SectionWrapper
          hasDifference={hasToolVariablesDifference}
          base={
            <ToolVariableViewer
              toolVariables={state.tool_exec_environment_variables}
            />
          }
          compared={
            toCompare && (
              <ToolVariableViewer
                toolVariables={state.tool_exec_environment_variables}
                comparedVariables={toCompare?.tool_exec_environment_variables}
              />
            )
          }
          title={t('ToolVariableViewer.title')}
        ></SectionWrapper>
      </VStack>
    </SingleStateViewerContext.Provider>
  );
}

interface StateHeaderProps {
  name: string;
}

function StateHeader(props: StateHeaderProps) {
  const { name } = props;

  return (
    <HStack
      fullWidth
      className="h-[28px]"
      borderBottom
      color="background-grey"
      align="center"
      paddingX="xsmall"
    >
      <Typography bold variant="body4" uppercase>
        {name}
      </Typography>
    </HStack>
  );
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
      baseName={baseName}
      comparedName={comparedName}
      state={cleanedBaseState}
      toCompare={cleanedComparedState}
      tools={tools}
      sources={sources}
    />
  );
}

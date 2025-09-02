import { useAgentsServiceRetrieveAgentContextWindow } from '@letta-cloud/sdk-core';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useCoreMemorySummaryWorker } from './hooks/useCoreMemorySummaryWorker/useCoreMemorySummaryWorker';
import type { WorkerResponse } from './types';
import {
  Button,
  Chart,
  Code,
  CompressIcon,
  ContextExplorerIcon,
  DynamicApp,
  HStack,
  makeFormattedTooltip,
  Tooltip,
  Typography,
  VerticalDelineatedTextChunker,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { VerticalBarChartChunk } from '@letta-cloud/ui-component-library';

import type { EChartsOption } from 'echarts';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import { atom, useAtom } from 'jotai';
import './ContextEditorPanel.scss';
import { useCurrentAgent } from '../../hooks';
import { useCurrentSimulatedAgent } from '../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { SummerizerDialog } from '../../SummerizerDialog/SummerizerDialog';
import type * as echarts from 'echarts';

const CONTEXT_PARTS = {
  system: 'system',
  tool: 'tool',
  external: 'external',
  coreMemory: 'coreMemory',
  recursiveMemory: 'recursiveMemory',
  messages: 'messages',
};

const computedMemoryStringAtom = atom<string | null>(null);

function useContextWindowDetails() {
  const { system, llm_config, ...rest } = useCurrentAgent();
  const { id, simulatedAgent } = useCurrentSimulatedAgent();

  const [computedMemoryString, setComputedMemoryString] = useAtom(
    computedMemoryStringAtom,
  );

  const { data: contextWindow } = useAgentsServiceRetrieveAgentContextWindow(
    {
      agentId: id,
    },
    undefined,
    {
      enabled: !!id,
      refetchInterval: 5000,
    },
  );

  const memory = useMemo(() => {
    return simulatedAgent?.memory || rest.memory;
  }, [simulatedAgent?.memory, rest.memory]);

  const { postMessage } = useCoreMemorySummaryWorker({
    onMessage: (message: MessageEvent<WorkerResponse>) => {
      setComputedMemoryString(message.data);
    },
  });

  useEffect(() => {
    if (!memory) {
      return;
    }

    postMessage({
      templateString: memory.prompt_template || '',
      context: {
        memory: memory.blocks,
      },
    });
  }, [memory, postMessage]);

  const systemPromptLength = useMemo(() => {
    return contextWindow?.num_tokens_system || 0;
  }, [contextWindow?.num_tokens_system]);

  const toolLength = useMemo(() => {
    return contextWindow?.num_tokens_functions_definitions || 0;
  }, [contextWindow?.num_tokens_functions_definitions]);

  const externalSummaryLength = useMemo(() => {
    return contextWindow?.num_tokens_external_memory_summary || 0;
  }, [contextWindow?.num_tokens_external_memory_summary]);

  const coreMemoryLength = useMemo(() => {
    return contextWindow?.num_tokens_core_memory || 0;
  }, [contextWindow?.num_tokens_core_memory]);

  const recursiveMemoryLength = useMemo(() => {
    return contextWindow?.num_tokens_summary_memory || 0;
  }, [contextWindow?.num_tokens_summary_memory]);

  const messagesTokensLength = useMemo(() => {
    return contextWindow?.num_tokens_messages || 0;
  }, [contextWindow?.num_tokens_messages]);

  const systemPromptSummary = system;
  const toolSummary = contextWindow?.functions_definitions;
  const externalSummary = contextWindow?.external_memory_summary;
  const coreMemorySummary = contextWindow?.core_memory || computedMemoryString;
  const recursiveMemorySummary = contextWindow?.summary_memory;
  const messagesTokensSummary = contextWindow?.messages
    ?.slice(1)
    ?.map((message) => {
      // Filter to only standard OpenAI message fields
      const cleanedMessage: any = {
        role: message.role,
        content: message.content,
      };

      // Include optional standard fields if present
      if (message.tool_calls && message.tool_calls !== null) {
        cleanedMessage.tool_calls = message.tool_calls;
      }
      if (message.name && message.name !== null) {
        cleanedMessage.name = message.name;
      }
      if (message.tool_call_id && message.tool_call_id !== null) {
        cleanedMessage.tool_call_id = message.tool_call_id;
      }

      return cleanedMessage;
    });

  // Memoize the JSON stringification to avoid expensive re-renders
  const messagesJsonString = useMemo(() => {
    if (!messagesTokensSummary) return '';
    return JSON.stringify(messagesTokensSummary, null, 2);
  }, [messagesTokensSummary]);

  const totalUsedLength = useMemo(() => {
    return (
      systemPromptLength +
      toolLength +
      externalSummaryLength +
      coreMemoryLength +
      recursiveMemoryLength +
      messagesTokensLength
    );
  }, [
    systemPromptLength,
    toolLength,
    externalSummaryLength,
    coreMemoryLength,
    recursiveMemoryLength,
    messagesTokensLength,
  ]);

  const totalLength = useMemo(() => {
    return llm_config?.context_window || 0;
  }, [llm_config?.context_window]);

  const remainingLength = useMemo(() => {
    return Math.max(0, totalLength - totalUsedLength);
  }, [totalLength, totalUsedLength]);

  const totalLengthForChart = useMemo(() => {
    return Math.max(totalLength, totalUsedLength);
  }, [totalLength, totalUsedLength]);

  return {
    systemPromptLength,
    toolLength,
    externalSummaryLength,
    coreMemoryLength,
    recursiveMemoryLength,
    messagesTokensLength,
    remainingLength,
    totalUsedLength,
    totalLength,
    totalLengthForChart,
    systemPromptSummary,
    toolSummary,
    externalSummary,
    coreMemorySummary,
    recursiveMemorySummary,
    messagesTokensSummary,
    messagesJsonString,
  };
}

export function ContextWindowPanel() {
  const {
    systemPromptLength,
    toolLength,
    externalSummaryLength,
    coreMemoryLength,
    recursiveMemoryLength,
    messagesTokensLength,
    remainingLength,
    totalUsedLength,
    totalLength,
    totalLengthForChart,
  } = useContextWindowDetails();

  const t = useTranslations('ADE/ContextEditorPanel');
  const { formatNumber, formatTokenSize } = useFormatters();

  // Add percentage calculation
  const percentageRemaining = useMemo(() => {
    if (totalLength === 0) return 0;
    return Math.round((remainingLength / totalLength) * 100) / 100;
  }, [remainingLength, totalLength]);

  const standardChartOptions = useMemo(() => {
    const commonSeriesStyles = {
      label: {
        show: true,
      },
      type: 'bar',
      stackStrategy: 'positive',
      stack: 'total',
    } as const;

    const opts: EChartsOption = {
      tooltip: {
        show: true,
        appendToBody: true,
      },
      grid: {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      xAxis: {
        show: false,
        type: 'value',
        splitLine: {
          show: false,
        },
        axisLine: {
          show: false,
        },
      },
      yAxis: {
        show: false,
        type: 'category',
        data: [''],
        splitLine: {
          show: false,
        },
        axisLine: {
          show: false,
        },
      },
      series: [
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              const percentage =
                totalLength > 0
                  ? Math.round((systemPromptLength / totalLength) * 100)
                  : 0;
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: `${e.seriesName || ''} (${formatNumber(percentage / 100, { style: 'percent' })})`,
                value: `${systemPromptLength}`,
              });
            },
          },
          data: [systemPromptLength / totalLengthForChart],
          color: '#3f5ff9',
          name: t('ContextWindowPreview.systemPrompt'),
          itemStyle: {
            borderRadius: [0, 0, 0, 0],
          },
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              const percentage =
                totalLength > 0
                  ? Math.round((toolLength / totalLength) * 100)
                  : 0;
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: `${e.seriesName || ''} (${formatNumber(percentage / 100, { style: 'percent' })})`,
                value: `${toolLength}`,
              });
            },
          },
          data: [toolLength / totalLengthForChart],
          color: '#6ba5b3',
          name: t('ContextWindowPreview.toolPrompt'),
          itemStyle: {
            borderRadius: [0, 0, 0, 0],
          },
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              const percentage =
                totalLength > 0
                  ? Math.round((externalSummaryLength / totalLength) * 100)
                  : 0;
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: `${e.seriesName || ''} (${formatNumber(percentage / 100, { style: 'percent' })})`,
                value: `${externalSummaryLength}`,
              });
            },
          },
          data: [externalSummaryLength / totalLengthForChart],
          color: '#36a373',
          name: t('ContextWindowPreview.externalSummaryLength'),
          itemStyle: {
            borderRadius: [0, 0, 0, 0],
          },
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              const percentage =
                totalLength > 0
                  ? Math.round((coreMemoryLength / totalLength) * 100)
                  : 0;
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: `${e.seriesName || ''} (${formatNumber(percentage / 100, { style: 'percent' })})`,
                value: `${coreMemoryLength}`,
              });
            },
          },
          data: [coreMemoryLength / totalLengthForChart],
          color: '#fce054',
          name: t('ContextWindowPreview.memoryBlocks'),
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              const percentage =
                totalLength > 0
                  ? Math.round((recursiveMemoryLength / totalLength) * 100)
                  : 0;
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: `${e.seriesName || ''} (${formatNumber(percentage / 100, { style: 'percent' })})`,
                value: `${recursiveMemoryLength}`,
              });
            },
          },
          data: [recursiveMemoryLength / totalLengthForChart],
          color: '#ff8c00',
          name: t('ContextWindowPreview.summaryMemory'),
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              const percentage =
                totalLength > 0
                  ? Math.round((messagesTokensLength / totalLength) * 100)
                  : 0;
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: `${e.seriesName || ''} (${formatNumber(percentage / 100, { style: 'percent' })})`,
                value: `${messagesTokensLength}`,
              });
            },
          },
          data: [messagesTokensLength / totalLengthForChart],
          color: '#9d37f9',
          name: t('ContextWindowPreview.messagesTokens'),
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              const percentage =
                totalLength > 0
                  ? Math.round((remainingLength / totalLength) * 100)
                  : 0;
              return makeFormattedTooltip({
                color: 'hsl(var(--input))',
                label: `${e.seriesName || ''} (${formatNumber(percentage / 100, { style: 'percent' })})`,
                value: `${remainingLength}`,
              });
            },
          },
          data: [remainingLength / totalLengthForChart],
          color: 'transparent',
          name: t('ContextWindowPreview.remaining'),
          itemStyle: {
            borderRadius: [0, 0, 0, 0],
          },
        },
      ],
    };

    if (!Array.isArray(opts.series)) {
      return opts;
    }

    // make sure first and last series have rounded corners
    const totalSeriesSize = opts.series.length;

    if (totalSeriesSize === 1) {
      // @ts-expect-error - this is a valid type
      opts.series[0].itemStyle = {
        borderRadius: 0,
      };
    }

    if (totalSeriesSize > 1) {
      // @ts-expect-error - this is a valid type
      opts.series[0].itemStyle = {
        borderRadius: [0, 0, 0, 0],
      };
      // @ts-expect-error - this is a valid type
      opts.series[totalSeriesSize - 1].itemStyle = {
        borderRadius: [0, 0, 0, 0],
      };
    }

    return opts;
  }, [
    systemPromptLength,
    totalLengthForChart,
    t,
    toolLength,
    externalSummaryLength,
    coreMemoryLength,
    recursiveMemoryLength,
    messagesTokensLength,
    remainingLength,
    totalLength, // Add this dependency
    formatNumber, // Add this dependency
  ]);

  const [_, setOpenContextDialog] = useAtom(contextEditorDialogState);

  const onChartInit = useCallback(
    (chart: echarts.ECharts) => {
      chart.on('click', (params) => {
        if (params.componentType === 'series') {
          const seriesName = params.seriesName;

          setOpenContextDialog(true);

          const idMap: Record<string, string> = {
            [t('ContextWindowPreview.systemPrompt')]: CONTEXT_PARTS.system,
            [t('ContextWindowPreview.toolPrompt')]: CONTEXT_PARTS.tool,
            [t('ContextWindowPreview.externalSummaryLength')]:
              CONTEXT_PARTS.external,
            [t('ContextWindowPreview.memoryBlocks')]: CONTEXT_PARTS.coreMemory,
            [t('ContextWindowPreview.summaryMemory')]:
              CONTEXT_PARTS.recursiveMemory,
            [t('ContextWindowPreview.messagesTokens')]: CONTEXT_PARTS.messages,
          };

          if (!seriesName) {
            return;
          }

          const elementId = idMap[seriesName];

          requestAnimationFrame(() => {
            if (elementId) {
              const element = document.getElementById(
                `context-window-simulator-${elementId}-bar`,
              );
              if (element) {
                element.click();
              }
            }
          });
        }
      });
    },
    [t, setOpenContextDialog],
  );

  return (
    <VStack fullWidth gap="small" paddingX="small" paddingBottom="xsmall">
      <HStack gap="small" fullWidth>
        <div className="w-full relative">
          <div className="w-full relative z-[1] px-[1px]">
            <Chart
              onInit={onChartInit}
              height={25}
              options={standardChartOptions}
            />
          </div>
          <div className="h-[19px] mt-[3px] w-full absolute z-[0] pointer-events-none top-0 bg-panel-input-background border border-input" />
        </div>
        <HStack align="center">
          <ContextEditorDialog
            trigger={
              <Button
                square
                size="2xsmall"
                color="secondary"
                hideLabel
                id="open-context-window-simulator"
                preIcon={<ContextExplorerIcon />}
                label={t('ContextWindowPreview.viewContextWindow')}
              />
            }
          />
          <SummerizerDialog
            trigger={
              <Button
                square
                size="2xsmall"
                hideLabel
                color="tertiary"
                preIcon={<CompressIcon />}
                label={t('ContextWindowPreview.summarize')}
              />
            }
          />
        </HStack>
      </HStack>
      <HStack align="center" justify="spaceBetween">
        <HStack gap={false} fullWidth justify="spaceBetween">
          <Typography
            color={totalUsedLength > totalLength ? 'destructive' : 'muted'}
            variant="body4"
          >
            {t.rich('ContextWindowPreview.usage', {
              total: () => (
                <Tooltip
                  content={t('tokens', { count: formatNumber(totalLength) })}
                >
                  <span>{formatTokenSize(totalLength)}</span>
                </Tooltip>
              ),
              used: () => {
                return (
                  <Tooltip
                    content={t('tokens', {
                      count: formatNumber(totalUsedLength),
                    })}
                  >
                    <span
                      className="font-semibold"
                      style={{
                        color:
                          totalUsedLength > totalLength
                            ? 'hsl(var(--destructive))'
                            : 'hsl(var(--text-default))',
                      }}
                    >
                      {formatTokenSize(totalUsedLength)}
                    </span>
                  </Tooltip>
                );
              },
            })}
          </Typography>
          <Typography color="muted" variant="body4">
            {t('ContextWindowPreview.remainingTokens', {
              percentageRemaining: formatNumber(percentageRemaining, {
                maximumFractionDigits: 2,
                style: 'percent',
              }),
            })}
          </Typography>
        </HStack>
      </HStack>
    </VStack>
  );
}

function ContextWindowSimulator() {
  const {
    systemPromptLength,
    toolLength,
    externalSummaryLength,
    coreMemoryLength,
    recursiveMemoryLength,
    messagesTokensLength,
    systemPromptSummary,
    toolSummary,
    externalSummary,
    coreMemorySummary,
    recursiveMemorySummary,
    messagesJsonString,
    totalLength,
  } = useContextWindowDetails();

  const t = useTranslations('ADE/ContextEditorPanel');

  const chunks: VerticalBarChartChunk[] = useMemo(() => {
    return [
      {
        id: CONTEXT_PARTS.system,
        label: t('ContextWindowPreview.systemPrompt'),
        content: (
          <Code
            language="xml"
            code={systemPromptSummary || ''}
            fontSize="small"
            showLineNumbers={false}
            variant="minimal"
          />
        ),
        size: systemPromptLength,
        color: '#3f5ff9',
      },
      {
        id: CONTEXT_PARTS.tool,
        label: t('ContextWindowPreview.toolPrompt'),
        content: (
          <Code
            code={JSON.stringify(toolSummary, null, 2)}
            fontSize="small"
            showLineNumbers={false}
            variant="minimal"
            language="javascript"
          />
        ),
        size: toolLength,
        color: '#6ba5b3',
      },
      {
        id: CONTEXT_PARTS.external,
        label: t('ContextWindowPreview.externalSummaryLength'),
        content: (
          <Code
            language="xml"
            code={externalSummary || ''}
            fontSize="small"
            showLineNumbers={false}
            variant="minimal"
          />
        ),
        size: externalSummaryLength,
        color: '#36a373',
      },
      {
        id: CONTEXT_PARTS.coreMemory,
        label: t('ContextWindowPreview.memoryBlocks'),
        content: (
          <Code
            language="xml"
            code={coreMemorySummary || ''}
            fontSize="small"
            showLineNumbers={false}
            variant="minimal"
          />
        ),
        size: coreMemoryLength,
        color: '#fce054',
      },
      {
        id: CONTEXT_PARTS.recursiveMemory,
        label: t('ContextWindowPreview.summaryMemory'),
        content: (
          <Code
            language="javascript"
            code={recursiveMemorySummary || ''}
            fontSize="small"
            showLineNumbers={false}
            variant="minimal"
          />
        ),
        size: recursiveMemoryLength,
        color: '#ff8c00',
      },
      {
        id: CONTEXT_PARTS.messages,
        label: t('ContextWindowPreview.messagesTokens'),
        content: (
          <Code
            language="javascript"
            code={messagesJsonString}
            fontSize="small"
            showLineNumbers={false}
            variant="minimal"
          />
        ),
        size: messagesTokensLength,
        color: '#9d37f9',
      },
    ];
  }, [
    coreMemorySummary,
    externalSummary,
    messagesJsonString,
    recursiveMemorySummary,
    systemPromptSummary,
    toolSummary,
    externalSummaryLength,
    messagesTokensLength,
    recursiveMemoryLength,
    systemPromptLength,
    t,
    toolLength,
    coreMemoryLength,
  ]);

  return (
    <VStack fullHeight fullWidth>
      <VerticalDelineatedTextChunker
        fullHeight
        fullWidth
        id="context-window-simulator"
        chunks={chunks}
        totalContextSize={totalLength}
      />
    </VStack>
  );
}

interface ContextEditorDialogProps {
  trigger: React.ReactNode;
}

const contextEditorDialogState = atom<boolean>(false);

function ContextEditorDialog(props: ContextEditorDialogProps) {
  const { trigger } = props;

  const [open, setOpen] = useAtom(contextEditorDialogState);

  const t = useTranslations('ADE/ContextEditorPanel');

  return (
    <DynamicApp
      onOpenChange={setOpen}
      isOpen={open}
      defaultView="windowed"
      windowConfiguration={{
        minWidth: 350,
        minHeight: 350,
        defaultWidth: 400,
        defaultHeight: 600,
      }}
      trigger={trigger}
      name={t('title')}
    >
      <ContextWindowSimulator />
    </DynamicApp>
  );
}

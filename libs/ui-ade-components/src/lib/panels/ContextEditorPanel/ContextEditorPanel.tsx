import { useAgentsServiceRetrieveAgentContextWindow } from '@letta-cloud/sdk-core';
import React, { useEffect, useMemo } from 'react';
import { useCoreMemorySummaryWorker } from './hooks/useCoreMemorySummaryWorker/useCoreMemorySummaryWorker';
import type { WorkerResponse } from './types';
import {
  Chart,
  Code,
  HStack,
  makeFormattedTooltip,
  Typography,
  VerticalDelineatedTextChunker,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { VerticalBarChartChunk } from '@letta-cloud/ui-component-library';

import type { EChartsOption } from 'echarts';
import { useTranslations } from '@letta-cloud/translations';
import { atom, useAtom } from 'jotai';
import './ContextEditorPanel.scss';
import { useCurrentAgent } from '../../hooks';
import { useCurrentSimulatedAgent } from '../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { getTikTokenEncoder } from '@letta-cloud/utils-shared';

const computedMemoryStringAtom = atom<string | null>(null);

function useContextWindowDetails() {
  const { system, llm_config, ...rest } = useCurrentAgent();
  const { id, agentSession } = useCurrentSimulatedAgent();

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
    return agentSession?.body.agent.memory || rest.memory;
  }, [agentSession?.body.agent.memory, rest.memory]);

  const { postMessage } = useCoreMemorySummaryWorker({
    onMessage: (message: MessageEvent<WorkerResponse>) => {
      setComputedMemoryString(message.data);
    },
  });

  const encoder = useMemo(() => {
    return getTikTokenEncoder(llm_config?.model);
  }, [llm_config?.model]);

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
    return encoder.encode(system || '').length;
  }, [encoder, system]);

  const toolLength = useMemo(() => {
    return contextWindow?.num_tokens_functions_definitions || 0;
  }, [contextWindow?.num_tokens_functions_definitions]);

  const externalSummaryLength = useMemo(() => {
    return contextWindow?.num_tokens_external_memory_summary || 0;
  }, [contextWindow?.num_tokens_external_memory_summary]);

  const coreMemoryLength = useMemo(() => {
    return encoder.encode(computedMemoryString || '').length;
  }, [computedMemoryString, encoder]);

  const recursiveMemoryLength = useMemo(() => {
    return contextWindow?.num_tokens_summary_memory || 0;
  }, [contextWindow?.num_tokens_summary_memory]);

  const messagesTokensLength = useMemo(() => {
    return contextWindow?.num_tokens_messages || 0;
  }, [contextWindow?.num_tokens_messages]);

  const systemPromptSummary = system;
  const toolSummary = contextWindow?.functions_definitions;
  const externalSummary = contextWindow?.external_memory_summary;
  const coreMemorySummary = computedMemoryString;
  const recursiveMemorySummary = contextWindow?.summary_memory;
  const messagesTokensSummary = contextWindow?.messages;

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
  };
}

export function ContextWindowPanel() {
  const t = useTranslations('ADE/ContextEditorPanel');

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
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: e.seriesName || '',
                value: `${systemPromptLength}`,
              });
            },
          },
          data: [systemPromptLength / totalLengthForChart],
          color: '#3758F9',
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
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: e.seriesName || '',
                value: `${toolLength}`,
              });
            },
          },
          data: [toolLength / totalLengthForChart],
          color: '#37e2f9',
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
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: e.seriesName || '',
                value: `${externalSummaryLength}`,
              });
            },
          },
          data: [externalSummaryLength / totalLengthForChart],
          color: '#37f9a2',
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
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: e.seriesName || '',
                value: `${coreMemoryLength}`,
              });
            },
          },
          data: [coreMemoryLength / totalLengthForChart],
          color: '#76e76e',
          name: t('ContextWindowPreview.memoryBlocks'),
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: e.seriesName || '',
                value: `${recursiveMemoryLength}`,
              });
            },
          },
          data: [recursiveMemoryLength / totalLengthForChart],
          color: 'green',
          name: t('ContextWindowPreview.summaryMemory'),
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: e.seriesName || '',
                value: `${messagesTokensLength}`,
              });
            },
          },
          data: [messagesTokensLength / totalLengthForChart],
          color: 'orange',
          name: t('ContextWindowPreview.messagesTokens'),
        },
        {
          ...commonSeriesStyles,
          label: {
            show: false,
          },
          tooltip: {
            formatter: (e) => {
              return makeFormattedTooltip({
                color: `${e.color}`,
                label: e.seriesName || '',
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
  ]);

  return (
    <VStack fullWidth gap="small" paddingX="small" paddingY="xsmall">
      <HStack fullWidth justify="spaceBetween">
        <Typography variant="body3" uppercase bold>
          {t('title')}
        </Typography>
        <div className="pointer-events-none">
          <HStack fullWidth justify="spaceBetween">
            <div />
            <div className="pointer-events-auto">
              <Typography
                color={totalUsedLength > totalLength ? 'destructive' : 'muted'}
                variant="body2"
              >
                {t('ContextWindowPreview.usage', {
                  used: totalUsedLength,
                  total: totalLength,
                })}
              </Typography>
            </div>
          </HStack>
        </div>
      </HStack>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <div className="relative">
        <div className="relative z-[1] px-[1px]">
          <Chart height={25} options={standardChartOptions} />
        </div>
        <div className="h-[19px] mt-[3px] w-full absolute z-[0] pointer-events-none top-0 bg-panel-input-background border border-input" />
      </div>
    </VStack>
  );
}

export function ContextWindowSimulator() {
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
    messagesTokensSummary,
  } = useContextWindowDetails();

  const t = useTranslations('ADE/ContextEditorPanel');

  const chunks: VerticalBarChartChunk[] = useMemo(() => {
    return [
      {
        id: 'system',
        label: t('ContextWindowPreview.systemPrompt'),
        content: (
          <Typography variant="body2" font="mono">
            {systemPromptSummary}
          </Typography>
        ),
        size: systemPromptLength,
        color: '#3758F9',
      },
      {
        id: 'tool',
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
        color: '#37e2f9',
      },
      {
        id: 'external',
        label: t('ContextWindowPreview.externalSummaryLength'),
        content: (
          <Typography variant="body2" font="mono">
            {externalSummary}
          </Typography>
        ),
        size: externalSummaryLength,
        color: '#37f9a2',
      },
      {
        id: 'coreMemory',
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
        color: '#76e76e',
      },
      {
        id: 'recursiveMemory',
        label: t('ContextWindowPreview.summaryMemory'),
        content: recursiveMemorySummary || '',
        size: recursiveMemoryLength,
        color: 'green',
      },
      {
        id: 'messages',
        label: t('ContextWindowPreview.messagesTokens'),
        content: (
          <Code
            language="javascript"
            code={JSON.stringify(messagesTokensSummary, null, 2)}
            fontSize="small"
            showLineNumbers={false}
            variant="minimal"
          />
        ),
        size: messagesTokensLength,
        color: 'orange',
      },
    ];
  }, [
    coreMemorySummary,
    externalSummary,
    messagesTokensSummary,
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
      <VerticalDelineatedTextChunker fullHeight fullWidth chunks={chunks} />
    </VStack>
  );
}

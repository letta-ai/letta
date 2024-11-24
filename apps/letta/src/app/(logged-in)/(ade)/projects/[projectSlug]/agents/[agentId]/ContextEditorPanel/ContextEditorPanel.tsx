import { useCurrentAgent } from '../hooks';

import { useAgentsServiceGetAgentContextWindow } from '@letta-web/letta-agents-api';
import React, { useEffect, useMemo } from 'react';
import { useCoreMemorySummaryWorker } from './hooks/useCoreMemorySummaryWorker/useCoreMemorySummaryWorker';
import type { WorkerResponse } from './types';
import {
  Chart,
  ContextWindowIcon,
  HStack,
  type PanelTemplate,
  Typography,
  VStack,
} from '@letta-web/component-library';
import type { EChartsOption } from 'echarts';
import { useTranslations } from 'next-intl';
import { atom, useAtom } from 'jotai';
import { z } from 'zod';
import type { TiktokenModel } from 'js-tiktoken';
import { encodingForModel } from 'js-tiktoken';
import { useCurrentUser } from '$letta/client/hooks';

const computedMemoryStringAtom = atom<string | null>(null);

const supportedModels: TiktokenModel[] = [
  'davinci-002',
  'babbage-002',
  'text-davinci-003',
  'text-davinci-002',
  'text-davinci-001',
  'text-curie-001',
  'text-babbage-001',
  'text-ada-001',
  'davinci',
  'curie',
  'babbage',
  'ada',
  'code-davinci-002',
  'code-davinci-001',
  'code-cushman-002',
  'code-cushman-001',
  'davinci-codex',
  'cushman-codex',
  'text-davinci-edit-001',
  'code-davinci-edit-001',
  'text-embedding-ada-002',
  'text-similarity-davinci-001',
  'text-similarity-curie-001',
  'text-similarity-babbage-001',
  'text-similarity-ada-001',
  'text-search-davinci-doc-001',
  'text-search-curie-doc-001',
  'text-search-babbage-doc-001',
  'text-search-ada-doc-001',
  'code-search-babbage-code-001',
  'code-search-ada-code-001',
  'gpt2',
  'gpt-3.5-turbo',
  'gpt-35-turbo',
  'gpt-3.5-turbo-0301',
  'gpt-3.5-turbo-0613',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-16k',
  'gpt-3.5-turbo-16k-0613',
  'gpt-3.5-turbo-instruct',
  'gpt-3.5-turbo-instruct-0914',
  'gpt-4',
  'gpt-4-0314',
  'gpt-4-0613',
  'gpt-4-32k',
  'gpt-4-32k-0314',
  'gpt-4-32k-0613',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4-turbo-preview',
  'gpt-4-1106-preview',
  'gpt-4-0125-preview',
  'gpt-4-vision-preview',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06',
  'gpt-4o-mini-2024-07-18',
  'gpt-4o-mini',
  'o1-mini',
  'o1-preview',
  'o1-preview-2024-09-12',
  'o1-mini-2024-09-12',
  'chatgpt-4o-latest',
  'gpt-4o-realtime',
  'gpt-4o-realtime-preview-2024-10-01',
];

function isTiktokenModel(model: string): model is TiktokenModel {
  return supportedModels.includes(model as TiktokenModel);
}

function ContextWindowPanel() {
  const t = useTranslations('ADE/ContextEditorPanel');
  const { memory, system, id, llm_config } = useCurrentAgent();
  const [computedMemoryString, setComputedMemoryString] = useAtom(
    computedMemoryStringAtom
  );

  const { data: contextWindow } = useAgentsServiceGetAgentContextWindow(
    {
      agentId: id,
    },
    undefined,
    {
      refetchInterval: 2500,
    }
  );

  const { postMessage } = useCoreMemorySummaryWorker({
    onMessage: (message: MessageEvent<WorkerResponse>) => {
      setComputedMemoryString(message.data);
    },
  });

  const encorder = useMemo(() => {
    let tokenModel: TiktokenModel = 'gpt-4';

    if (llm_config && isTiktokenModel(llm_config.model)) {
      tokenModel = llm_config.model;
    }

    return encodingForModel(tokenModel);
  }, [llm_config]);

  useEffect(() => {
    if (!memory) {
      return;
    }

    postMessage({
      templateString: memory.prompt_template || '',
      context: {
        memory: memory.memory || {},
      },
    });
  }, [memory, postMessage]);

  const systemPromptLength = useMemo(() => {
    return encorder.encode(system || '').length;
  }, [encorder, system]);

  const toolLength = useMemo(() => {
    return contextWindow?.num_tokens_functions_definitions || 0;
  }, [contextWindow?.num_tokens_functions_definitions]);

  const externalSummaryLength = useMemo(() => {
    return contextWindow?.num_tokens_external_memory_summary || 0;
  }, [contextWindow?.num_tokens_external_memory_summary]);

  const coreMemoryLength = useMemo(() => {
    return encorder.encode(computedMemoryString || '').length;
  }, [computedMemoryString, encorder]);

  const recursiveMemoryLength = useMemo(() => {
    return contextWindow?.num_tokens_summary_memory || 0;
  }, [contextWindow?.num_tokens_summary_memory]);

  const messagesTokensLength = useMemo(() => {
    return contextWindow?.num_tokens_messages || 0;
  }, [contextWindow?.num_tokens_messages]);

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

  const user = useCurrentUser();

  const totalLengthForChart = useMemo(() => {
    return Math.max(totalLength, totalUsedLength);
  }, [totalLength, totalUsedLength]);

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
            formatter: (e) => `${e.seriesName}: ${systemPromptLength}`,
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
            formatter: (e) => `${e.seriesName}: ${toolLength}`,
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
            formatter: (e) => `${e.seriesName}: ${externalSummaryLength}`,
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
            formatter: (e) => `${e.seriesName}: ${coreMemoryLength}`,
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
            formatter: (e) => `${e.seriesName}: ${recursiveMemoryLength}`,
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
            formatter: (e) => `${e.seriesName}: ${messagesTokensLength}`,
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
              return `${e.seriesName}: ${remainingLength}`;
            },
          },
          data: [remainingLength / totalLengthForChart],
          color: user?.theme === 'dark' ? '#333' : '#eee',
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
    user?.theme,
  ]);

  return (
    <VStack gap="small" paddingX="large" paddingY="xsmall">
      <div className="mt-[-35px]">
        <HStack fullWidth justify="spaceBetween">
          <div />
          <Typography
            color={totalUsedLength > totalLength ? 'destructive' : 'muted'}
            variant="body2"
          >
            {t('ContextWindowPreview.usage', {
              used: totalUsedLength,
              total: totalLength,
            })}
          </Typography>
        </HStack>
      </div>
      {/* eslint-disable-next-line react/forbid-component-props */}
      <Chart height={35} options={standardChartOptions} />
    </VStack>
  );
}

export const contextWindowPanel = {
  templateId: 'context-window',
  icon: <ContextWindowIcon />,
  useGetTitle: () => {
    const t = useTranslations('ADE/ContextEditorPanel');

    return t('title');
  },
  useGetMobileTitle: () => {
    const t = useTranslations('ADE/ContextEditorPanel');

    return t('mobileTitle');
  },
  content: ContextWindowPanel,
  data: z.object({}),
} satisfies PanelTemplate<'context-window'>;

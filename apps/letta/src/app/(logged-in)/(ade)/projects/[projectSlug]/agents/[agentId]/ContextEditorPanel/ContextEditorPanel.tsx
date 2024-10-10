import { useCurrentAgent } from '../hooks';

import {
  useAgentsServiceGetAgentArchivalMemorySummary,
  useAgentsServiceGetAgentRecallMemorySummary,
} from '@letta-web/letta-agents-api';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCoreMemorySummaryWorker } from './hooks/useCoreMemorySummaryWorker/useCoreMemorySummaryWorker';
import type { WorkerResponse } from './types';
import {
  Chart,
  Frame,
  HStack,
  Popover,
  Typography,
  VStack,
} from '@letta-web/component-library';
import type { EChartsOption } from 'echarts';
import { useTranslations } from 'next-intl';
import { atom, useAtom } from 'jotai';

const computedMemoryStringAtom = atom<string | null>(null);

export function ContextWindowPreview() {
  const [open, setOpen] = useState(false);
  const t = useTranslations('ADE/ContextEditorPanel');
  const { system, memory, id, llm_config } = useCurrentAgent();
  const [computedMemoryString, setComputedMemoryString] = useAtom(
    computedMemoryStringAtom
  );

  useAgentsServiceGetAgentArchivalMemorySummary({
    agentId: id,
  });
  useAgentsServiceGetAgentRecallMemorySummary({
    agentId: id,
  });

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
        memory: memory.memory || {},
      },
    });
  }, [memory, postMessage]);

  const totalLength = useMemo(() => {
    return llm_config.context_window;
  }, [llm_config.context_window]);

  const systemPromptLength = useMemo(() => {
    return system.length;
  }, [system.length]);

  const coreMemoryLength = useMemo(() => {
    return computedMemoryString?.length || 0;
  }, [computedMemoryString?.length]);

  const totalUsedLength = useMemo(() => {
    return systemPromptLength + coreMemoryLength;
  }, [systemPromptLength, coreMemoryLength]);

  const remainingLength = useMemo(() => {
    return totalLength - totalUsedLength;
  }, [totalLength, totalUsedLength]);

  const miniChartOptions: EChartsOption = useMemo(() => {
    return {
      tooltip: {
        show: false,
      },
      grid: {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      xAxis: {
        type: 'value',
        splitLine: {
          show: false,
        },
        axisLine: {
          show: false,
        },
      },
      yAxis: {
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
          data: [systemPromptLength / totalLength],
          type: 'bar',
          stack: 'total',
          color: '#3758F9',
          name: t('ContextWindowPreview.systemPrompt'),
          itemStyle: {
            borderRadius: [50, 0, 0, 50],
          },
        },
        {
          data: [coreMemoryLength / totalLength],
          type: 'bar',
          color: '#6EE7B7',
          stack: 'total',
          name: t('ContextWindowPreview.memoryBlocks'),
        },
        {
          data: [remainingLength / totalLength],
          type: 'bar',
          color: 'gray',
          stack: 'total',
          name: t('ContextWindowPreview.remaining'),
          itemStyle: {
            borderRadius: [0, 50, 50, 0],
          },
        },
      ],
    };
  }, [coreMemoryLength, remainingLength, systemPromptLength, t, totalLength]);

  const standardChartOptions = useMemo(() => {
    const commonSeriesStyles = {
      label: {
        show: true,
      },
      type: 'bar',
      stack: 'total',
    } as const;

    const opts: EChartsOption = {
      tooltip: {
        show: false,
      },
      legend: {
        icon: 'circle',
        orient: 'horizontal',
        bottom: 0,
        left: 0,
      },
      grid: {
        top: 0,
        left: 0,
        right: 0,
        bottom: 25,
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
            ...commonSeriesStyles.label,
            formatter: () => `${systemPromptLength}`,
          },
          data: [systemPromptLength / totalLength],
          color: '#3758F9',
          name: t('ContextWindowPreview.systemPrompt'),
          itemStyle: {
            borderRadius: [6, 0, 0, 6],
          },
        },
        {
          ...commonSeriesStyles,
          label: {
            ...commonSeriesStyles.label,
            formatter: () => `${coreMemoryLength}`,
          },
          data: [coreMemoryLength / totalLength],
          color: '#6EE7B7',
          name: t('ContextWindowPreview.memoryBlocks'),
        },
        {
          ...commonSeriesStyles,
          label: {
            ...commonSeriesStyles.label,
            formatter: () => `${remainingLength}`,
          },
          data: [remainingLength / totalLength],
          color: 'gray',
          name: t('ContextWindowPreview.remaining'),
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
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
        borderRadius: 6,
      };
    }

    if (totalSeriesSize > 1) {
      // @ts-expect-error - this is a valid type
      opts.series[0].itemStyle = {
        borderRadius: [6, 0, 0, 6],
      };
      // @ts-expect-error - this is a valid type
      opts.series[totalSeriesSize - 1].itemStyle = {
        borderRadius: [0, 6, 6, 0],
      };
    }

    return opts;
  }, [coreMemoryLength, remainingLength, systemPromptLength, t, totalLength]);

  const isReady = useMemo(() => {
    return computedMemoryString;
  }, [computedMemoryString]);
  const handleSetOpen = useCallback(
    (status: boolean) => {
      if (!isReady && status) {
        setOpen(false);
        return;
      }

      setOpen(status);
    },
    [isReady]
  );

  const handleMouseEnter = useCallback(() => {
    handleSetOpen(true);
  }, [handleSetOpen]);

  const handleMouseLeave = useCallback(() => {
    handleSetOpen(false);
  }, [handleSetOpen]);

  return (
    <Popover
      /* eslint-disable-next-line react/forbid-component-props */
      className="w-[400px]"
      align="end"
      offset={-2}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      trigger={
        <HStack
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          align="center"
          justify="end"
          transparent={!isReady}
        >
          {/* eslint-disable-next-line react/forbid-component-props*/}
          <HStack
            justify="end"
            className="h-[24px] mt-[1px] transition-all w-[100px]"
            rounded
            paddingY="small"
            overflow="hidden"
          >
            <Chart options={miniChartOptions} />
          </HStack>
          <Typography variant="body2" color="muted">
            {t('ContextWindowPreview.usage', {
              total: totalLength,
              used: totalUsedLength,
            })}
          </Typography>
        </HStack>
      }
      open={open}
      onOpenChange={handleSetOpen}
    >
      <VStack gap="small" paddingX="small" paddingY="xsmall">
        <HStack fullWidth justify="spaceBetween">
          <Typography variant="body2" bold>
            {t('ContextWindowPreview.popover.title')}
          </Typography>
          <Typography variant="body2">
            {t('ContextWindowPreview.popover.usage', {
              used: totalUsedLength,
              total: totalLength,
            })}
          </Typography>
        </HStack>
        {/* eslint-disable-next-line react/forbid-component-props */}
        <Frame className="h-[50px]" fullWidth>
          <Chart options={standardChartOptions} />
        </Frame>
      </VStack>
    </Popover>
  );
}

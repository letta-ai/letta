'use client';
import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  HStack,
  VStack,
  ChevronRightIcon,
  TabGroup,
  HiddenOnMobile,
  VisibleOnMobile,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useFormatters } from '@letta-cloud/utils-client';
import { MetricCard } from './components/MetricCard/MetricCard';
import { ObservabilityProvider, useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import type { TimeRange } from '$web/client/hooks/useObservabilityContext/timeConfig';
import { useObservabilityChartData } from './hooks/useObservabilityChartData';

const TIME_RANGE_OPTIONS = [
  { label: '1h', value: '1h' as const },
  { label: '12h', value: '12h' as const },
  { label: '1d', value: '1d' as const },
  { label: '7d', value: '7d' as const },
  { label: '30d', value: '30d' as const },
];

function TimeRangeSelector() {
  const { timeRange, setTimeRange } = useObservabilityContext();

  const handleTimeRangeChange = useCallback(
    (value: string) => {
      setTimeRange(value as TimeRange);
    },
    [setTimeRange],
  );

  return (
    <TabGroup
      variant="chips"
      size="xxsmall"
      onValueChange={handleTimeRangeChange}
      value={timeRange}
      items={TIME_RANGE_OPTIONS}
      border
    />
  );
}

interface MiniObservabilityDashboardInnerProps {
  projectId: string;
}

const MiniObservabilityDashboardInner = React.memo(function MiniObservabilityDashboardInner({ projectId }: MiniObservabilityDashboardInnerProps) {
  const { startDate, endDate, baseTemplateId, timeRange } = useObservabilityContext();
  const { formatNumber, formatSmallDuration } = useFormatters();
  const t = useTranslations('projects/(projectSlug)/page.MiniObservabilityDashboard');
  const { slug: projectSlug } = useCurrentProject();

  const previousPeriodStartDate = useMemo(() => {
    const current = new Date(startDate);
    const duration = new Date(endDate).getTime() - new Date(startDate).getTime();
    return new Date(current.getTime() - duration).toISOString();
  }, [startDate, endDate]);

  const previousPeriodEndDate = useMemo(() => {
    return startDate;
  }, [startDate]);

  // current period overview metrics
  const { data: overview, isLoading: overviewLoading } =
    webApi.observability.getObservabilityOverview.useQuery({
      queryKey: webApiQueryKeys.observability.getObservabilityOverview({
        projectId,
        startDate,
        endDate,
        baseTemplateId: baseTemplateId?.value,
      }),
      queryData: {
        query: {
          projectId,
          startDate,
          endDate,
          baseTemplateId: baseTemplateId?.value,
        },
      },
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

  // previous period overview metrics for trend comparison
  const { data: previousOverview } =
    webApi.observability.getObservabilityOverview.useQuery({
      queryKey: webApiQueryKeys.observability.getObservabilityOverview({
        projectId,
        startDate: previousPeriodStartDate,
        endDate: previousPeriodEndDate,
        baseTemplateId: baseTemplateId?.value,
      }),
      queryData: {
        query: {
          projectId,
          startDate: previousPeriodStartDate,
          endDate: previousPeriodEndDate,
          baseTemplateId: baseTemplateId?.value,
        },
      },
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    });

  // data for total messages (current)
  const { data: messagesData, isLoading: messagesLoading } = webApi.observability.getTotalMessagesPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getTotalMessagesPerDay({
      projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        baseTemplateId: baseTemplateId?.value,
        projectId,
        startDate,
        endDate,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // data for tool error counts (current)
  const { data: toolErrorsData, isLoading: toolErrorsLoading } = webApi.observability.getToolErrorsMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getToolErrorsMetrics({
      projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        endDate,
        baseTemplateId: baseTemplateId?.value,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // previous period tool error counts for trend comparison
  const { data: previousToolErrorsData } = webApi.observability.getToolErrorsMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getToolErrorsMetrics({
      projectId,
      startDate: previousPeriodStartDate,
      endDate: previousPeriodEndDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        projectId,
        startDate: previousPeriodStartDate,
        endDate: previousPeriodEndDate,
        baseTemplateId: baseTemplateId?.value,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // data for step counts (current)
  const { data: stepsData, isLoading: stepsLoading } = webApi.observability.getStepsMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getStepsMetrics({
      projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        endDate,
        baseTemplateId: baseTemplateId?.value,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // previous period step counts for trend comparison
  const { data: previousStepsData } = webApi.observability.getStepsMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getStepsMetrics({
      projectId,
      startDate: previousPeriodStartDate,
      endDate: previousPeriodEndDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        projectId,
        startDate: previousPeriodStartDate,
        endDate: previousPeriodEndDate,
        baseTemplateId: baseTemplateId?.value,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // data for API errors (current)
  const { data: apiErrorsData, isLoading: apiErrorsLoading } = webApi.observability.getApiErrorCount.useQuery({
    queryKey: webApiQueryKeys.observability.getApiErrorCount({
      projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        baseTemplateId: baseTemplateId?.value,
        projectId,
        startDate,
        endDate,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // previous period API errors for trend comparison
  const { data: previousApiErrorsData } = webApi.observability.getApiErrorCount.useQuery({
    queryKey: webApiQueryKeys.observability.getApiErrorCount({
      projectId,
      startDate: previousPeriodStartDate,
      endDate: previousPeriodEndDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        baseTemplateId: baseTemplateId?.value,
        projectId,
        startDate: previousPeriodStartDate,
        endDate: previousPeriodEndDate,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // data for tool latency P50/P99 percentiles (current)
  const { data: toolLatencyData, isLoading: toolLatencyLoading } = webApi.observability.getToolLatencyPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getToolLatencyPerDay({
      projectId,
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        endDate,
        baseTemplateId: baseTemplateId?.value,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // previous period tool latency percentiles for trend comparison
  const { data: previousToolLatencyData } = webApi.observability.getToolLatencyPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getToolLatencyPerDay({
      projectId,
      startDate: previousPeriodStartDate,
      endDate: previousPeriodEndDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        projectId,
        startDate: previousPeriodStartDate,
        endDate: previousPeriodEndDate,
        baseTemplateId: baseTemplateId?.value,
        timeRange,
      },
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const {
    messagesChartData,
    toolErrorsChartData,
    stepsPerHourChartData,
    apiErrorsChartData,
    toolLatencyP50ChartData,
    toolLatencyP99ChartData,
    medianToolLatencyP50,
    medianToolLatencyP99,
  } = useObservabilityChartData({
    messagesData,
    toolErrorsData,
    stepsData,
    apiErrorsData,
    toolLatencyData,
  });

  // calculate totals for trend comparison (current period)
  const currentPeriodTotals = useMemo(() => {
    const totalMessages = overview?.body.totalMessageCount || 0;
    const totalSteps = stepsData?.body.items.reduce((sum, item) => sum + (item.totalStepsCount || 0), 0) || 0;
    const totalToolErrors = toolErrorsData?.body.items.reduce((sum, item) => sum + (item.errorCount || 0), 0) || 0;
    const totalApiErrors = apiErrorsData?.body.items.reduce((sum, item) => sum + (item.apiErrorCount || 0), 0) || 0;

    // calculate median latencies for current period
    const currentP50Latencies = toolLatencyData?.body.items
      .filter(item => item.p50LatencyMs && item.p50LatencyMs > 0)
      .map(item => item.p50LatencyMs!) || [];
    const currentP99Latencies = toolLatencyData?.body.items
      .filter(item => item.p99LatencyMs && item.p99LatencyMs > 0)
      .map(item => item.p99LatencyMs!) || [];

    const medianP50 = currentP50Latencies.length > 0
      ? currentP50Latencies.sort((a, b) => a - b)[Math.floor(currentP50Latencies.length / 2)]
      : 0;
    const medianP99 = currentP99Latencies.length > 0
      ? currentP99Latencies.sort((a, b) => a - b)[Math.floor(currentP99Latencies.length / 2)]
      : 0;

    return {
      totalMessages,
      totalSteps,
      totalToolErrors,
      totalApiErrors,
      toolErrorRate: totalSteps > 0 ? (totalToolErrors / totalSteps) * 100 : 0,
      medianP50Latency: medianP50,
      medianP99Latency: medianP99,
    };
  }, [overview, stepsData, toolErrorsData, apiErrorsData, toolLatencyData]);

  // calculate totals for trend comparison (prev period)
  const previousPeriodTotals = useMemo(() => {
    const totalMessages = previousOverview?.body.totalMessageCount || 0;
    const totalSteps = previousStepsData?.body.items.reduce((sum, item) => sum + (item.totalStepsCount || 0), 0) || 0;
    const totalToolErrors = previousToolErrorsData?.body.items.reduce((sum, item) => sum + (item.errorCount || 0), 0) || 0;
    const totalApiErrors = previousApiErrorsData?.body.items.reduce((sum, item) => sum + (item.apiErrorCount || 0), 0) || 0;

    // calculate median latencies for prev period
    const previousP50Latencies = previousToolLatencyData?.body.items
      .filter(item => item.p50LatencyMs && item.p50LatencyMs > 0)
      .map(item => item.p50LatencyMs!) || [];
    const previousP99Latencies = previousToolLatencyData?.body.items
      .filter(item => item.p99LatencyMs && item.p99LatencyMs > 0)
      .map(item => item.p99LatencyMs!) || [];

    const medianP50 = previousP50Latencies.length > 0
      ? previousP50Latencies.sort((a, b) => a - b)[Math.floor(previousP50Latencies.length / 2)]
      : 0;
    const medianP99 = previousP99Latencies.length > 0
      ? previousP99Latencies.sort((a, b) => a - b)[Math.floor(previousP99Latencies.length / 2)]
      : 0;

    return {
      totalMessages,
      totalSteps,
      totalToolErrors,
      totalApiErrors,
      toolErrorRate: totalSteps > 0 ? (totalToolErrors / totalSteps) * 100 : 0,
      medianP50Latency: medianP50,
      medianP99Latency: medianP99,
    };
  }, [previousOverview, previousStepsData, previousToolErrorsData, previousApiErrorsData, previousToolLatencyData]);

  const calculatePeriodTrend = useCallback((currentValue: number, previousValue: number): 'up' | 'down' | 'neutral' => {
    if (currentValue === previousValue) return 'neutral';
    return currentValue > previousValue ? 'up' : 'down';
  }, []);

  const renderMetricCards = useCallback((isMobile: boolean = false) => {
    const rightBorderForDesktop = (isLast: boolean) => !isMobile && !isLast;
    const rightBorderForMobile = false;

    return (
      <>
        <MetricCard
          title={t('metrics.totalMessages')}
          value={overview?.body.totalMessageCount !== undefined ? formatNumber(overview.body.totalMessageCount) : undefined}
          previousPeriodValue={previousOverview?.body.totalMessageCount !== undefined ? formatNumber(previousOverview.body.totalMessageCount) : undefined}
          trend={previousOverview ?
            calculatePeriodTrend(currentPeriodTotals.totalMessages, previousPeriodTotals.totalMessages) :
            'neutral'}
          isLoading={overviewLoading}
          chartData={messagesChartData}
          showRightBorder={isMobile ? rightBorderForMobile : rightBorderForDesktop(false)}
          showBottomBorder={true}
          infoTooltip={{
            text: t('metrics.totalMessagesTooltip'),
          }}
        />

        <MetricCard
          title={t('metrics.totalStepsPerHour')}
          value={stepsData?.body.items.reduce((sum, item) => sum + (item.totalStepsCount || 0), 0) || 0}
          previousPeriodValue={previousStepsData?.body.items.reduce((sum, item) => sum + (item.totalStepsCount || 0), 0)}
          trend={previousStepsData ?
            calculatePeriodTrend(currentPeriodTotals.totalSteps, previousPeriodTotals.totalSteps) :
            'neutral'}
          isLoading={stepsLoading || messagesLoading}
          chartData={stepsPerHourChartData}
          showRightBorder={isMobile ? rightBorderForMobile : rightBorderForDesktop(true)}
          showBottomBorder={true}
          infoTooltip={{
            text: t('metrics.totalStepsTooltip'),
          }}
        />

        <MetricCard
          title={t('metrics.toolErrorRate')}
          value={`${currentPeriodTotals.toolErrorRate.toFixed(1)}%`}
          previousPeriodValue={`${previousPeriodTotals.toolErrorRate.toFixed(1)}%`}
          trend={previousToolErrorsData && previousStepsData ?
            calculatePeriodTrend(currentPeriodTotals.toolErrorRate, previousPeriodTotals.toolErrorRate) :
            'neutral'}
          isLoading={toolErrorsLoading || stepsLoading || messagesLoading}
          chartData={toolErrorsChartData}
          isInverted={true}
          showRightBorder={isMobile ? rightBorderForMobile : rightBorderForDesktop(false)}
          showBottomBorder={true}
          infoTooltip={{
            text: t('metrics.toolErrorRateTooltip'),
          }}
        />

        <MetricCard
          title={t('metrics.apiErrors')}
          value={apiErrorsData?.body.items.reduce((sum, item) => sum + (item.apiErrorCount || 0), 0) || 0}
          previousPeriodValue={previousApiErrorsData?.body.items.reduce((sum, item) => sum + (item.apiErrorCount || 0), 0)}
          trend={previousApiErrorsData ?
            calculatePeriodTrend(currentPeriodTotals.totalApiErrors, previousPeriodTotals.totalApiErrors) :
            'neutral'}
          isLoading={apiErrorsLoading || messagesLoading}
          chartData={apiErrorsChartData}
          isInverted={true}
          showRightBorder={isMobile ? rightBorderForMobile : rightBorderForDesktop(true)}
          showBottomBorder={true}
          infoTooltip={{
            text: t('metrics.apiErrorsTooltip'),
          }}
        />

        <MetricCard
          title={t('metrics.toolDurationP50')}
          value={medianToolLatencyP50 > 0
            ? formatSmallDuration(medianToolLatencyP50)
            : '0 μs'}
          previousPeriodValue={previousPeriodTotals.medianP50Latency > 0
            ? formatSmallDuration(previousPeriodTotals.medianP50Latency * 1_000_000)
            : '0 μs'}
          trend={previousToolLatencyData ?
            calculatePeriodTrend(currentPeriodTotals.medianP50Latency, previousPeriodTotals.medianP50Latency) :
            'neutral'}
          isLoading={toolLatencyLoading || messagesLoading}
          chartData={toolLatencyP50ChartData}
          isInverted={true}
          showRightBorder={isMobile ? rightBorderForMobile : rightBorderForDesktop(false)}
          showBottomBorder={isMobile}
          infoTooltip={{
            text: t('metrics.toolDurationP50Tooltip'),
          }}
        />

        <MetricCard
          title={t('metrics.toolDurationP99')}
          value={medianToolLatencyP99 > 0
            ? formatSmallDuration(medianToolLatencyP99)
            : '0 μs'}
          previousPeriodValue={previousPeriodTotals.medianP99Latency > 0
            ? formatSmallDuration(previousPeriodTotals.medianP99Latency * 1_000_000)
            : '0 μs'}
          trend={previousToolLatencyData ?
            calculatePeriodTrend(currentPeriodTotals.medianP99Latency, previousPeriodTotals.medianP99Latency) :
            'neutral'}
          isLoading={toolLatencyLoading || messagesLoading}
          chartData={toolLatencyP99ChartData}
          isInverted={true}
          showRightBorder={isMobile ? rightBorderForMobile : rightBorderForDesktop(true)}
          showBottomBorder={false}
          infoTooltip={{
            text: t('metrics.toolDurationP99Tooltip'),
          }}
        />
      </>
    );
  }, [
    t, overview, previousOverview, calculatePeriodTrend, currentPeriodTotals,
    overviewLoading, messagesChartData, stepsData, previousStepsData,
    stepsLoading, messagesLoading, stepsPerHourChartData, previousToolErrorsData,
    toolErrorsLoading, toolErrorsChartData, apiErrorsData, previousApiErrorsData,
    apiErrorsLoading, apiErrorsChartData, medianToolLatencyP50, previousPeriodTotals,
    previousToolLatencyData, toolLatencyLoading, toolLatencyP50ChartData,
    medianToolLatencyP99, toolLatencyP99ChartData, formatNumber, formatSmallDuration
  ]);

  return (
    <VStack
      fullWidth
      fullHeight
      border
      gap="large"
      padding
      className="w-full"
    >
      <HStack justify="spaceBetween" align="center" fullWidth className="h-biHeight-sm">
        <HStack align="center">
          <Link href={`/projects/${projectSlug}/observability`} className="text-lg text-text-default font-semibold flex items-center gap-1">
            {t('title')}
            <ChevronRightIcon className="h-5 w-5" />
          </Link>
        </HStack>
        <TimeRangeSelector />
      </HStack>

      <>
        <HiddenOnMobile>
          <div className="grid grid-cols-2 gap-0 w-full border border-background-grey3-border">
            {renderMetricCards(false)}
          </div>
        </HiddenOnMobile>
        <VisibleOnMobile>
          <div className="grid grid-cols-1 gap-0 w-full border border-background-grey3-border">
            {renderMetricCards(true)}
          </div>
        </VisibleOnMobile>
      </>
    </VStack>
  );
});

interface MiniObservabilityDashboardProps {
  projectId?: string;
}

export function MiniObservabilityDashboard({ projectId }: MiniObservabilityDashboardProps) {
  const { id: currentProjectId } = useCurrentProject();
  const effectiveProjectId = projectId || currentProjectId;

  if (!effectiveProjectId) {
    return null;
  }

  return (
    <ObservabilityProvider noTemplateFilter defaultTimeRange="1d">
      <MiniObservabilityDashboardInner projectId={effectiveProjectId} />
    </ObservabilityProvider>
  );
}

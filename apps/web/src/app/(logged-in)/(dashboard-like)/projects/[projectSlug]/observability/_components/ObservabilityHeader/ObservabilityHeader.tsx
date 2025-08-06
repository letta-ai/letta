'use client';
import {
  Breadcrumb,
  HStack,
  MonitoringIcon,
  TabGroup,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { ChartType } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import type { TimeRange } from '$web/client/hooks/useObservabilityContext/timeConfig';
import { useCallback } from 'react';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import AdvancedObservabilityFilter from './AdvancedObservabilityFilter/AdvancedObservabilityFilter';

const TIME_RANGE_OPTIONS = [
  { label: '1 hour', value: '1h' as const },
  { label: '4 hours', value: '4h' as const },
  { label: '12 hours', value: '12h' as const },
  { label: '1 day', value: '1d' as const },
  { label: '7 days', value: '7d' as const },
  { label: '30 days', value: '30d' as const },
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
    />
  );
}

interface ObservabilityHeaderProps {
  subPage?: {
    title: string;
  };
}

function ChartSelector() {
  const { chartType, setChartType } = useObservabilityContext();
  const t = useTranslations('pages/projects/observability/ObservabilityHeader');

  return (
    <TabGroup
      variant="chips"
      size="xsmall"
      onValueChange={(value) => {
        if (!value) return;

        setChartType(value as ChartType);
      }}
      value={chartType}
      items={[
        {
          label: t('ChartSelector.all'),
          value: 'all',
        },
        {
          label: t('ChartSelector.activity'),
          value: 'activity',
        },
        {
          label: t('ChartSelector.performance'),
          value: 'performance',
        },
        {
          label: t('ChartSelector.errors'),
          value: 'errors',
        },
      ]}
    />
  );
}

export function ObservabilityHeader(props: ObservabilityHeaderProps) {
  const t = useTranslations('pages/projects/observability/ObservabilityHeader');
  const { subPage } = props;
  const { slug } = useCurrentProject();

  const { noTemplateFilter } = useObservabilityContext();

  return (
    <HStack
      borderBottom
      paddingTop="xxsmall"
      paddingX="medium"
      align="center"
      /* eslint-disable-next-line react/forbid-component-props */
      className="min-h-[54px] h-[54px]"
      fullWidth
    >
      <HStack align="center" fullWidth justify="spaceBetween">
        <Breadcrumb
          size="small"
          items={[
            {
              preIcon: <MonitoringIcon />,
              bold: true,
              ...(subPage ? { href: `/projects/${slug}/observability` } : {}),
              label: t('root'),
              contentOverride: !subPage ? <ChartSelector /> : null,
            },
            ...(subPage
              ? [
                  {
                    label: subPage.title,
                  },
                ]
              : []),
          ]}
        />
        <HStack>
          <TimeRangeSelector />
          {!noTemplateFilter && <AdvancedObservabilityFilter />}
        </HStack>
      </HStack>
    </HStack>
  );
}

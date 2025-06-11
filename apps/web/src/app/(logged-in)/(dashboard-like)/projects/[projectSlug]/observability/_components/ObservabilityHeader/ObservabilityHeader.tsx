'use client';
import {
  Breadcrumb,
  HStack,
  MonitoringIcon,
  TabGroup,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import type { ChartType } from '../hooks/useObservabilityContext/useObservabilityContext';
import { useObservabilityContext } from '../hooks/useObservabilityContext/useObservabilityContext';
import { useCallback, useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';

type DateTypes =
  | '7Days'
  | '30Days'
  | '60Days'
  | '90Days'
  | '365Days'
  | 'Custom';

function DateRangeSelector() {
  const { startDate, endDate, setDateRange } = useObservabilityContext();

  const t = useTranslations('pages/projects/observability/ObservabilityHeader');
  const dateType = useMemo(() => {
    if (!startDate || !endDate) return 'Custom';
    const days = differenceInDays(endDate, startDate);

    switch (days) {
      case 30:
        return '30Days';
      case 7:
        return '7Days';
      case 60:
        return '60Days';
      case 90:
        return '90Days';
      case 365:
        return '365Days';
      default:
        return 'Custom';
    }
  }, [startDate, endDate]);

  const setSpecificDateRange = useCallback(
    (value: DateTypes) => {
      const now = new Date();
      let start: Date;
      const end: Date = now;

      switch (value) {
        case '30Days':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '7Days':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '60Days':
          start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
          break;
        case '90Days':
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '365Days':
          start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          return; // Custom date range, do nothing
      }

      setDateRange(start, end);
    },
    [setDateRange],
  );

  return (
    <TabGroup
      variant="chips"
      size="xxsmall"
      onValueChange={(value) => {
        setSpecificDateRange(value as DateTypes);
      }}
      value={dateType}
      items={[
        {
          label: t('DateRangeSelector.7Days'),
          value: '7Days',
        },
        {
          label: t('DateRangeSelector.30Days'),
          value: '30Days',
        },
        {
          label: t('DateRangeSelector.60Days'),
          value: '60Days',
        },
        {
          label: t('DateRangeSelector.90Days'),
          value: '90Days',
        },
        // {
        //   label: t('DateRangeSelector.365Days'),
        //   value: '365Days',
        // },
      ]}
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
        <DateRangeSelector />
      </HStack>
    </HStack>
  );
}

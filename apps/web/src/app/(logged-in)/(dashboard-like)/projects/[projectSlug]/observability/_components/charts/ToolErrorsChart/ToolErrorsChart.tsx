'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeFormattedTooltip,
  Button,
  ExternalLinkIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { get } from 'lodash-es';
import { useObservabilitySeriesData } from '../../hooks/useObservabilitySeriesData/useObservabilitySeriesData';
import { useObservabilityContext } from '../../hooks/useObservabilityContext/useObservabilityContext';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';

interface TimeToFirstTokenChartProps {
  analysisLink?: string;
}

export function ToolErrorsChart(props: TimeToFirstTokenChartProps) {
  const { startDate, endDate, baseTemplateId } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();
  const { projectSlug } = useParams<{ projectSlug: string }>();

  const t = useTranslations('pages/projects/observability/ToolErrorsChart');

  const { data } = webApi.observability.getToolErrorsMetrics.useQuery({
    queryKey: webApiQueryKeys.observability.getToolErrorsMetrics({
      projectId,
      startDate,
      baseTemplateId: baseTemplateId?.value,
      endDate,
    }),
    queryData: {
      query: {
        projectId,
        baseTemplateId: baseTemplateId?.value,
        startDate,
        endDate,
      },
    },
  });

  // Create the URL for tool error responses using project slug
  const toolErrorResponsesUrl = useMemo(() => {
    const query = {
      root: {
        combinator: 'AND',
        items: [
          {
            field: 'statusCode',
            queryData: {
              operator: {
                label: 'is',
                value: 'eq',
              },
              value: {
                label: 'tool error',
                value: 'tool_error',
              },
            },
          },
        ],
      },
    };

    // Encode and then manually fix the + encoding
    let encodedQuery = encodeURIComponent(JSON.stringify(query));
    encodedQuery = encodedQuery.replace('tool%20error', 'tool+error');

    return `/projects/${projectSlug}/responses?query=${encodedQuery}`;
  }, [projectSlug]);

  const tableOptions = useObservabilitySeriesData({
    seriesData: [
      {
        data: data?.body.items,
        getterFn: (item) => item.errorCount || 0,
        defaultValue: 0,
      },
    ],
    startDate,
    endDate,
  });

  return (
    <DashboardChartWrapper
      analysisLink={analysisLink}
      title={t('title')}
      isLoading={!data}
      headerActions={
        <Button
          label="View Tool Errors"
          color="tertiary"
          size="xsmall"
          href={toolErrorResponsesUrl}
          target="_blank"
          preIcon={<ExternalLinkIcon />}
          hideLabel
        />
      }
    >
      <Chart
        options={{
          ...tableOptions,
          yAxis: {
            ...tableOptions.yAxis,
            startValue: 0,
            minInterval: 1,
            max: function (value) {
              return Math.max(value.max, 5);
            },
          },
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              const value = get(e, '0.data.value', null);
              const date = get(e, '0.axisValue', '');

              return makeFormattedTooltip({
                label: t('tooltip'),
                date: date,
                value: `${value || 0}`,
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}

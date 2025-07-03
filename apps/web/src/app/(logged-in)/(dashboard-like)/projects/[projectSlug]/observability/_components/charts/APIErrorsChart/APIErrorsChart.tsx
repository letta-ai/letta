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

export function APIErrorsChart(props: TimeToFirstTokenChartProps) {
  const { startDate, endDate, baseTemplateId } = useObservabilityContext();
  const { analysisLink } = props;
  const { id: projectId } = useCurrentProject();
  const { projectSlug } = useParams<{ projectSlug: string }>();

  const t = useTranslations('pages/projects/observability/APIErrorsChart');

  // Get template details if baseTemplateId is set
  const { data: templateData } =
    webApi.agentTemplates.getAgentTemplateById.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateById(
        baseTemplateId?.value || '',
      ),
      queryData: {
        params: {
          id: baseTemplateId?.value || '',
        },
      },
      enabled: !!baseTemplateId?.value,
    });

  const { data } = webApi.observability.getApiErrorCount.useQuery({
    queryKey: webApiQueryKeys.observability.getApiErrorCount({
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
  });

  // Create the URL for API error responses using project slug with template filtering
  const apiErrorResponsesUrl = useMemo(() => {
    const queryItems = [
      {
        field: 'statusCode',
        queryData: {
          operator: {
            label: 'is',
            value: 'eq',
          },
          value: {
            label: 'API error',
            value: 'api_error',
          },
        },
      },
    ];

    // Add template family filter if a template is selected
    if (baseTemplateId?.value && templateData?.body) {
      queryItems.push({
        field: 'templateFamily',
        queryData: {
          operator: {
            label: 'equals',
            value: 'eq',
          },
          value: {
            label: templateData.body.name,
            value: baseTemplateId.value,
          },
        },
      });
    }

    const query = {
      root: {
        combinator: 'AND',
        items: queryItems,
      },
    };

    return `/projects/${projectSlug}/responses?query=${encodeURIComponent(JSON.stringify(query))}`;
  }, [projectSlug, baseTemplateId?.value, templateData?.body]);

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
          label="View API Errors"
          color="tertiary"
          size="xsmall"
          href={apiErrorResponsesUrl}
          target="_blank"
          postIcon={<ExternalLinkIcon />}
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
                date,
                value: `${value || 0}`,
              });
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}

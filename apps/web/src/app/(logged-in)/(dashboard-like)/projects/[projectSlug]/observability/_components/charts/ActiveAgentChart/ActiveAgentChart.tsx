'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeFormattedTooltip,
  Alert,
  Button,
  ExternalLinkIcon,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { get } from 'lodash-es';
import { useObservabilitySeriesData } from '../../hooks/useObservabilitySeriesData/useObservabilitySeriesData';
import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import { useMemo } from 'react';

export function ActiveAgentChart() {
  const { id: projectId, slug } = useCurrentProject();
  const { startDate, endDate, baseTemplateId, timeRange } =
    useObservabilityContext();

  const t = useTranslations('pages/projects/observability/ActiveAgentChart');

  // Check if time range is sub-daily
  const isSubDaily = timeRange && ['1h', '4h', '12h'].includes(timeRange);

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

  const { data } = webApi.observability.getActiveAgentsPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getActiveAgentsPerDay({
      projectId: projectId, // Replace with actual project slug
      startDate,
      endDate,
      baseTemplateId: baseTemplateId?.value,
      timeRange,
    }),
    queryData: {
      query: {
        baseTemplateId: baseTemplateId?.value,
        projectId: projectId,
        startDate,
        endDate,
        timeRange,
      },
    },
  });

  const tableOptions = useObservabilitySeriesData({
    startDate,
    endDate,
    seriesData: [
      {
        data: data?.body.returningActiveAgents,
        getterFn: (item) => item.activeAgents,
        defaultValue: 0,
      },
      {
        data: data?.body.newActiveAgents,
        getterFn: (item) => item.activeAgents,
        defaultValue: 0,
      },
    ],
  });

  const { formatNumber } = useFormatters();

  // Build the agents URL with template filter if present
  const agentsUrl = useMemo(() => {
    const baseUrl = `/projects/${slug}/agents`;

    if (!baseTemplateId?.value || !templateData?.body) {
      // No template filter - link to agents page with default query showing "Any Template Family"
      const query = {
        root: {
          combinator: 'AND',
          items: [
            {
              field: 'templateName',
              queryData: {
                operator: { label: 'equals', value: 'eq' },
                value: {
                  label: '(Any Template Family)',
                  value: '',
                },
              },
            },
          ],
        },
      };
      return `${baseUrl}?query=${encodeURIComponent(JSON.stringify(query))}`;
    }

    // Template is selected - use the template name as the family filter
    const templateName = templateData.body.name;
    const query = {
      root: {
        combinator: 'AND',
        items: [
          {
            field: 'templateName',
            queryData: {
              operator: { label: 'equals', value: 'eq' },
              value: {
                label: templateName,
                value: baseTemplateId.value, // Use the template ID as the value
              },
            },
          },
        ],
      },
    };

    return `${baseUrl}?query=${encodeURIComponent(JSON.stringify(query))}`;
  }, [slug, baseTemplateId?.value, templateData?.body]);

  if (isSubDaily) {
    return (
      <DashboardChartWrapper
        title={t('title')}
        isLoading={!data}
        headerActions={
          <Button
            label="View Agents"
            color="tertiary"
            size="xsmall"
            href={agentsUrl}
            target="_blank"
            postIcon={<ExternalLinkIcon />}
            hideLabel
          />
        }
      >
        <Alert title="Active agent metrics not available for time ranges under one day" />
      </DashboardChartWrapper>
    );
  }

  return (
    <DashboardChartWrapper
      title={t('title')}
      isLoading={!data}
      headerActions={
        <Button
          label="View Agents"
          color="tertiary"
          size="xsmall"
          href={agentsUrl}
          target="_blank"
          postIcon={<ExternalLinkIcon />}
          hideLabel
        />
      }
    >
      <Chart
        options={{
          ...tableOptions,
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              let returningAgents = get(e, '0.data.value', 0);
              let newAgents = get(e, '1.data.value', 0);
              const date = get(e, '0.axisValue', '');

              if (typeof returningAgents === 'string') {
                returningAgents = parseInt(returningAgents, 10);
              }

              if (typeof newAgents === 'string') {
                newAgents = parseInt(newAgents, 10);
              }

              if (typeof returningAgents !== 'number') {
                returningAgents = 0;
              }

              if (typeof newAgents !== 'number') {
                newAgents = 0;
              }

              return makeFormattedTooltip({
                date,
                label: t('tooltip', {
                  returningAgents: formatNumber(returningAgents || 0, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }),
                  newAgents: formatNumber(newAgents || 0, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }),
                }),
              });
            },
          },
          yAxis: {
            ...tableOptions.yAxis,
            startValue: 0,
            minInterval: 1,
            max: function (value) {
              return Math.max(value.max, 5);
            },
          },
        }}
      />
    </DashboardChartWrapper>
  );
}

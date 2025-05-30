'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  Chart,
  DashboardChartWrapper,
  makeFormattedTooltip,
} from '@letta-cloud/ui-component-library';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { get } from 'lodash-es';
import { useObservabilitySeriesData } from '../../hooks/useObservabilitySeriesData/useObservabilitySeriesData';
import { useObservabilityContext } from '../../hooks/useObservabilityContext/useObservabilityContext';

export function ActiveAgentChart() {
  const { id: projectId } = useCurrentProject();
  const { startDate, endDate } = useObservabilityContext();

  const t = useTranslations('pages/projects/observability/ActiveAgentChart');

  const { data } = webApi.observability.getActiveAgentsPerDay.useQuery({
    queryKey: webApiQueryKeys.observability.getActiveAgentsPerDay({
      projectId,
      startDate,
      endDate,
    }),
    queryData: {
      query: {
        projectId,
        startDate,
        endDate,
      },
    },
  });

  const tableOptions = useObservabilitySeriesData({
    startDate,
    endDate,
    seriesData: [
      {
        data: data?.body.newActiveAgents,
        getterFn: (item) => item.activeAgents,
      },
      {
        data: data?.body.returningActiveAgents,
        getterFn: (item) => item.activeAgents,
      },
    ],
  });

  const { formatNumber } = useFormatters();

  return (
    <DashboardChartWrapper title={t('title')} isLoading={!data}>
      <Chart
        options={{
          ...tableOptions,
          tooltip: {
            trigger: 'axis',
            formatter: (e) => {
              let returningAgents = get(e, '0.data', null);
              let newAgents = get(e, '1.data', null);

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
                label: t('tooltip', {
                  newAgents: formatNumber(newAgents || 0, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }),
                  returningAgents: formatNumber(returningAgents || 0, {
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

'use client';
import { HR, HStack, VR, VStack } from '@letta-cloud/ui-component-library';
import { TotalMessagesPerDayChart } from './_components/charts/TotalMessagesPerDayChart/TotalMessagesPerDayChart';

import './observability.scss';

import { ActiveAgentChart } from './_components/charts/ActiveAgentChart/ActiveAgentChart';
import { ObservabilityPageWrapper } from './_components/ObservabilityPageWrapper/ObservabilityPageWrapper';
import { ToolErrorsChart } from './_components/charts/ToolErrorsChart/ToolErrorsChart';
import { TotalResponseTimeChart } from './_components/charts/TotalResponseTimeChart/TotalResponseTimeChart';
import { APIErrorsChart } from './_components/charts/APIErrorsChart/APIErrorsChart';
import { ToolErrorRateChart } from './_components/charts/ToolErrorRateChart/ToolErrorRateChart';
import { ToolErrorsByNameChart } from './_components/charts/ToolErrorsByNameChart/ToolErrorsByNameChart';
import { ToolLatencyChart } from './_components/charts/ToolLatencyChart/ToolLatencyChart';
import { ToolLatencyByToolNameChart } from './_components/charts/ToolLatencyByToolNameChart/ToolLatencyByToolNameChart';
import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import { Fragment, useMemo } from 'react';
import { LLMLatencyChart } from './_components/charts/LLMLatencyChart/LLMLatencyChart';
import { LLMLatencyByModelNameChart } from './_components/charts/LLMLatencyByModelNameChart/LLMLatencyByModelNameChart';
import { TimeToFirstTokenChart } from './_components/charts/TimeToFirstTokenChart/TimeToFirstTokenChart';
import { StepDurationByNameChart } from './_components/charts/StepDurationByNameChart';
import { StepsMetricsChart } from './_components/charts/StepsMetricsChart';
import { TotalRequestsPerDayChart } from './_components/charts/TotalRequestsPerDayChart';

interface ChartRowProps {
  children: React.ReactNode;
}

function ChartRow(props: ChartRowProps) {
  const { children } = props;

  return <div className="observability-chart-row">{children}</div>;
}

const allCharts = [
  <TotalMessagesPerDayChart key="total-messages-per-day-chart" />,
  // <ToolErrorsChart key="tool-errors-chart" />,
  <TotalResponseTimeChart key="total-response-time-chart" />,
  <APIErrorsChart key="api-errors-chart" />,
  <ToolErrorRateChart key="tool-error-rate-chart" />,
  <LLMLatencyChart key="llm-latency-chart" />,
  <ToolLatencyChart key="tool-latency-chart" />,
  <ActiveAgentChart key="active-agent-chart" />,
];

const activityCharts = [
  <TotalMessagesPerDayChart key="total-messages-per-day-chart" />,
  <TotalRequestsPerDayChart key="total-requests-per-day-chart" />,
  <StepsMetricsChart type="total" key="steps-total-chart" />,
  <StepsMetricsChart type="p50" key="steps-p50-chart" />,
  <StepsMetricsChart type="p99" key="steps-p99-chart" />,
  <StepsMetricsChart type="avg" key="steps-avg-chart" />,
  <ActiveAgentChart key="active-agent-chart" />,
];

const performanceCharts = [
  <TotalResponseTimeChart key="total-response-time-chart" />,
  <LLMLatencyChart key="llm-latency-chart" />,

  <StepDurationByNameChart type="p50" key="step-duration-by-name-chart" />,
  <StepDurationByNameChart type="p99" key="step-duration-by-name-chart" />,
  <LLMLatencyByModelNameChart
    type="p50"
    key="llm-latency-by-model-name-chart"
  />,
  <LLMLatencyByModelNameChart
    type="p99"
    key="llm-latency-by-model-name-chart"
  />,
  <ToolLatencyByToolNameChart
    type="p50"
    key="llm-latency-by-tool-name-chart"
  />,
  <ToolLatencyByToolNameChart
    type="p99"
    key="llm-latency-by-tool-name-chart"
  />,

  <ToolLatencyChart key="tool-latency-chart" />,
  <TimeToFirstTokenChart key="time-to-first-token-chart" />,
];

const errorCharts = [
  <ToolErrorsChart key="tool-errors-chart" />,
  <APIErrorsChart key="api-errors-chart" />,
  <ToolErrorRateChart key="tool-error-rate-chart" />,
  <ToolErrorsByNameChart key="tool-errors-by-name-chart" />,
];

function ProjectObservabilityPage() {
  // const { slug } = useCurrentProject();
  const { chartType } = useObservabilityContext();

  const chartsToRender = useMemo(() => {
    switch (chartType) {
      case 'activity':
        return activityCharts;
      case 'performance':
        return performanceCharts;
      case 'errors':
        return errorCharts;
      default:
        return allCharts;
    }
  }, [chartType]);

  const groupCharts = useMemo(() => {
    const GROUP_SIZE = 2;
    const grouped: React.ReactNode[][] = [];
    for (let i = 0; i < chartsToRender.length; i += GROUP_SIZE) {
      grouped.push(chartsToRender.slice(i, i + GROUP_SIZE));
    }

    return grouped;
  }, [chartsToRender]);

  return (
    <ObservabilityPageWrapper>
      <HStack gap={false} fullWidth fullHeight>
        <VStack fullWidth fullHeight collapseWidth flex>
          <VStack overflowY="auto" gap={false} collapseHeight fullHeight flex>
            <VStack gap={false} fullWidth>
              {groupCharts.map((chartRow, index) => (
                <Fragment key={index}>
                  <ChartRow key={index}>
                    {chartRow.map((chart, index) => (
                      <Fragment key={index}>
                        <VStack key={index} fullWidth>
                          {chart}
                        </VStack>
                        {index < chartRow.length - 1 && <VR />}
                      </Fragment>
                    ))}
                  </ChartRow>
                  {index < groupCharts.length - 1 && <HR />}
                </Fragment>
              ))}
            </VStack>
          </VStack>
        </VStack>
      </HStack>
    </ObservabilityPageWrapper>
  );
}

export default ProjectObservabilityPage;

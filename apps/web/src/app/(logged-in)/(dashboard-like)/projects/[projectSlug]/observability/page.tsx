'use client';
import { HR, HStack, VR, VStack } from '@letta-cloud/ui-component-library';
// import { TimeToFirstTokenChart } from './_components/charts/TimeToFirstTokenChart/TimeToFirstTokenChart';
import { TotalMessagesPerDayChart } from './_components/charts/TotalMessagesPerDayChart/TotalMessagesPerDayChart';

import './observability.scss';

import { ActiveAgentChart } from './_components/charts/ActiveAgentChart/ActiveAgentChart';
// import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { ObservabilityPageWrapper } from './_components/ObservabilityPageWrapper/ObservabilityPageWrapper';
import { ToolErrorsChart } from './_components/charts/ToolErrorsChart/ToolErrorsChart';
import { ObservabilityOverview } from './_components/ObservabilityOverview/ObservabilityOverview';
import { TotalResponseTimeChart } from './_components/charts/TotalResponseTimeChart/TotalResponseTimeChart';
import { APIErrorsChart } from './_components/charts/APIErrorsChart/APIErrorsChart';
import { ToolErrorRateChart } from './_components/charts/ToolErrorRateChart/ToolErrorRateChart';
// import { LLMLatencyChart } from './_components/charts/LLMLatencyChart/LLMLatencyChart';
// import { ToolLatencyChart } from './_components/charts/ToolLatencyChart/ToolLatencyChart';
import { ToolUsageFrequencyChart } from './_components/charts/ToolUsageFrequencyChart/ToolUsageFrequencyChart';
// import { TimeToFirstTokenPerDayChart } from './_components/charts/TimeToFirstTokenPerDayChart/TimeToFirstTokenPerDayChart';
import { ToolErrorsByNameChart } from './_components/charts/ToolErrorsByNameChart/ToolErrorsByNameChart';

interface ChartRowProps {
  children: React.ReactNode;
}

function ChartRow(props: ChartRowProps) {
  const { children } = props;

  return <div className="observability-chart-row">{children}</div>;
}

function ProjectObservabilityPage() {
  // const { slug } = useCurrentProject();

  return (
    <ObservabilityPageWrapper>
      <HStack gap={false} fullWidth fullHeight>
        <VStack fullWidth fullHeight collapseWidth flex>
          <VStack overflowY="auto" gap={false} collapseHeight fullHeight flex>
            <ChartRow>
              <ActiveAgentChart />

              <VR />
              <TotalMessagesPerDayChart />
            </ChartRow>
            <HR />
            <ChartRow>
              <ToolErrorsChart
              // analysisLink={`/projects/${slug}/observability/tool-errors`}
              />
              <VR />
              <TotalResponseTimeChart />
            </ChartRow>
            <HR />
            <ChartRow>
              {/*<ToolLatencyChart />*/}
              <ToolErrorsByNameChart />

              <VR />
              <APIErrorsChart />
            </ChartRow>
            <HR />
            <ChartRow>
              <ToolErrorRateChart />
              <VR />
              <ToolUsageFrequencyChart />
              {/*<LLMLatencyChart />*/}
            </ChartRow>
            {/*<HR />*/}
            {/*<ChartRow>*/}
            {/*  <ToolUsageFrequencyChart />*/}
            {/*  /!*<VR />*!/*/}
            {/*  /!*<TimeToFirstTokenChart />*!/*/}
            {/*</ChartRow>*/}
            {/*<HR />*/}
            {/*<ChartRow>*/}
            {/*  <ToolErrorsByNameChart />*/}

            {/*  <VR />*/}
            {/*  <TimeToFirstTokenPerDayChart />*/}
            {/*</ChartRow>*/}
            <HR />
          </VStack>
        </VStack>
        <VR />
        <ObservabilityOverview />
      </HStack>
    </ObservabilityPageWrapper>
  );
}

export default ProjectObservabilityPage;

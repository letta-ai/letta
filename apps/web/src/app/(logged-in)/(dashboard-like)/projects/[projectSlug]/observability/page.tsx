'use client';
import { HR, HStack, VR, VStack } from '@letta-cloud/ui-component-library';
import { TimeToFirstTokenChart } from './_components/charts/TimeToFirstTokenChart/TimeToFirstTokenChart';
import { TotalMessagesPerDayChart } from './_components/charts/TotalMessagesPerDayChart/TotalMessagesPerDayChart';

import './observability.scss';

import { ActiveAgentChart } from './_components/charts/ActiveAgentChart/ActiveAgentChart';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { ObservabilityPageWrapper } from './_components/ObservabilityPageWrapper/ObservabilityPageWrapper';
import { ToolErrorsChart } from './_components/charts/ToolErrorsChart/ToolErrorsChart';
import { ObservabilityOverview } from './_components/ObservabilityOverview/ObservabilityOverview';
import { TotalResponseTimeChart } from './_components/charts/TotalResponseTimeChart/TotalResponseTimeChart';
import { APIErrorsChart } from './_components/charts/APIErrorsChart/APIErrorsChart';

interface ChartRowProps {
  children: React.ReactNode;
}

function ChartRow(props: ChartRowProps) {
  const { children } = props;

  return <div className="observability-chart-row">{children}</div>;
}

function ProjectObservabilityPage() {
  const { slug } = useCurrentProject();

  return (
    <ObservabilityPageWrapper>
      <HStack gap={false} fullWidth fullHeight>
        <VStack gap={false} fullHeight collapseWidth flex>
          <ChartRow>
            <TimeToFirstTokenChart
              analysisLink={`/projects/${slug}/observability/time-to-first-token`}
            />
            <VR />
            <TotalMessagesPerDayChart />
          </ChartRow>
          <HR />
          <ChartRow>
            <ToolErrorsChart
              analysisLink={`/projects/${slug}/observability/tool-errors`}
            />
            <VR />
            <ActiveAgentChart />
          </ChartRow>
          <HR />
          <ChartRow>
            <TotalResponseTimeChart />
            <VR />
            <APIErrorsChart />
          </ChartRow>
          <HR />
        </VStack>
        <VR />
        <ObservabilityOverview />
      </HStack>
    </ObservabilityPageWrapper>
  );
}

export default ProjectObservabilityPage;

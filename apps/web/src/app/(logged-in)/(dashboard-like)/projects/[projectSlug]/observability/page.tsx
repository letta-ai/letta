'use client';
import { HR, HStack, VR } from '@letta-cloud/ui-component-library';
import { TimeToFirstTokenChart } from './_components/charts/TimeToFirstTokenChart/TimeToFirstTokenChart';
import { TotalMessagesPerDayChart } from './_components/charts/TotalMessagesPerDayChart/TotalMessagesPerDayChart';

import './observability.scss';

import { ActiveAgentChart } from './_components/charts/ActiveAgentChart/ActiveAgentChart';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { ObservabilityPageWrapper } from './_components/ObservabilityPageWrapper/ObservabilityPageWrapper';
import { ToolErrorsChart } from './_components/charts/ToolErrorsChart/ToolErrorsChart';

function ProjectObservabilityPage() {
  const { slug } = useCurrentProject();

  return (
    <ObservabilityPageWrapper>
      <HStack gap={false}>
        <TimeToFirstTokenChart
          analysisLink={`/projects/${slug}/observability/time-to-first-token`}
        />
        <VR />
        <TotalMessagesPerDayChart />
      </HStack>
      <HR />
      <HStack gap={false}>
        <ToolErrorsChart
          analysisLink={`/projects/${slug}/observability/tool-errors`}
        />
        <VR />
        <ActiveAgentChart />
      </HStack>
    </ObservabilityPageWrapper>
  );
}

export default ProjectObservabilityPage;

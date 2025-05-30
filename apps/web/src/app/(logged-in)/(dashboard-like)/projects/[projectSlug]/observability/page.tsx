'use client';
import { HR, HStack, VR } from '@letta-cloud/ui-component-library';
import { TimeToFirstTokenChart } from './_components/charts/TimeToFirstTokenChart/TimeToFirstTokenChart';
import { TotalMessagesPerDayChart } from './_components/charts/TotalMessagesPerDayChart/TotalMessagesPerDayChart';

import './observability.scss';

import { ActiveAgentChart } from './_components/charts/ActiveAgentChart/ActiveAgentChart';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { ObservabilityPageWrapper } from './_components/ObservabilityPageWrapper/ObservabilityPageWrapper';

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
      <ActiveAgentChart />
    </ObservabilityPageWrapper>
  );
}

export default ProjectObservabilityPage;

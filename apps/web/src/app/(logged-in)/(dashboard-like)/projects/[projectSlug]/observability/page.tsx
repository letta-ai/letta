import { HStack, VStack } from '@letta-cloud/ui-component-library';
import { ObservabilityHeader } from './_components/ObservabilityHeader/ObservabilityHeader';
import { TimeToFirstTokenChart } from './_components/charts/TimeToFirstTokenChart/TimeToFirstTokenChart';
import { TotalMessagesPerDayChart } from './_components/charts/TotalMessagesPerDayChart/TotalMessagesPerDayChart';

import './observability.scss';

import { ObservabilityProvider } from './_components/hooks/useObservabilityContext/useObservabilityContext';
import { ActiveAgentChart } from './_components/charts/ActiveAgentChart/ActiveAgentChart';

function ProjectObservabilityPage() {
  return (
    <ObservabilityProvider>
      <div className="w-full pr-1 encapsulated-full-height h-full">
        <VStack fullWidth fullHeight gap={false}>
          <ObservabilityHeader />
          <VStack color="background-grey" fullHeight fullWidth padding="medium">
            <HStack>
              <TimeToFirstTokenChart />
              <TotalMessagesPerDayChart />
            </HStack>
            <ActiveAgentChart />
          </VStack>
        </VStack>
      </div>
    </ObservabilityProvider>
  );
}

export default ProjectObservabilityPage;

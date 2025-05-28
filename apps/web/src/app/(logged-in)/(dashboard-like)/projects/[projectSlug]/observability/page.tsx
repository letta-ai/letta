import { VStack } from '@letta-cloud/ui-component-library';
import { ObservabilityHeader } from './_components/ObservabilityHeader/ObservabilityHeader';
import { TimeToFirstTokenChart } from './_components/charts/TimeToFirstTokenChart/TimeToFirstTokenChart';
import { TotalMessagesPerDayChart } from './_components/charts/TotalMessagesPerDayChart/TotalMessagesPerDayChart';

import './observability.scss';

function ProjectObservabilityPage() {
  return (
    <div className="w-full pr-1 encapsulated-full-height h-full">
      <VStack fullWidth fullHeight gap={false}>
        <ObservabilityHeader />
        <div className="observability-grid w-full h-full bg-background-grey p-4 gap-1">
          <TimeToFirstTokenChart />
          <TotalMessagesPerDayChart />
        </div>
      </VStack>
    </div>
  );
}

export default ProjectObservabilityPage;

import { useRunsServiceRetrieveRun } from '@letta-cloud/sdk-core';
import { VStack } from '@letta-cloud/ui-component-library';

interface StepDetailsProps {
  stepId?: string;
  runId: string;
}


export function MessageToolbarDetails(props: StepDetailsProps) {
  const { runId } = props;

  useRunsServiceRetrieveRun({
    runId,
  }, undefined, {
    refetchInterval: (args) => {
      return args.state.data?.status === 'running' ? 3000 : false
    }
  })

  return (
    <VStack>
    </VStack>
  )
}

import React, { useState } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useStepsServiceRetrieveStep } from '@letta-cloud/sdk-core';
import { Alert, SideOverlay, VStack } from '@letta-cloud/ui-component-library';
import { TraceViewer } from './TraceViewer/TraceViewer';

interface DebugTraceSidebarProps {
  stepId: string;
  trigger: React.ReactNode;
}

export function DebugTraceSidebar(props: DebugTraceSidebarProps) {
  const { stepId, trigger } = props;
  const [open, setIsOpen] = useState(false);

  const { data: stepDetails } = useStepsServiceRetrieveStep(
    {
      stepId,
    },
    undefined,
    {
      enabled: open,
    },
  );

  const { data: traceData } = webApi.traces.getTrace.useQuery({
    queryKey: webApiQueryKeys.traces.getTrace(stepDetails?.trace_id || ''),
    queryData: {
      params: {
        traceId: stepDetails?.trace_id || '',
      },
    },
    enabled: !!stepDetails?.trace_id,
  });

  return (
    <SideOverlay
      trigger={trigger}
      isOpen={open}
      onOpenChange={setIsOpen}
      title="Debug"
    >
      <VStack padding overflowY="auto" fullWidth fullHeight>
        <Alert
          variant="warning"
          title="This is an internal debug page, know what you're doing here!"
        />
        <TraceViewer traces={traceData?.body || []} />
      </VStack>
    </SideOverlay>
  );
}

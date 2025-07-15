import React, { useMemo } from 'react';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useStepsServiceRetrieveStep } from '@letta-cloud/sdk-core';
import { HStack, Tooltip, Typography } from '@letta-cloud/ui-component-library';
import { useCurrentAgentMetaData, ViewMessageTrace } from '../../../../';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { useTotalTraceDuration } from '@letta-cloud/utils-client';

interface DebugTraceSidebarProps {
  stepId: string;
  trigger: React.ReactNode;
}

export function DebugTraceSidebar(props: DebugTraceSidebarProps) {
  const { stepId, trigger } = props;
  const { agentId } = useCurrentAgentMetaData();

  const { data: stepDetails } = useStepsServiceRetrieveStep(
    {
      stepId,
    },
    undefined,
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

  const traces = useMemo(() => {
    return traceData?.body || [];
  }, [traceData?.body]);

  const totalDuration = useTotalTraceDuration(traces);

  const { formatSmallDuration } = useFormatters();

  const t = useTranslations('components/DebugTraceSidebar');

  if (!stepDetails?.trace_id) {
    return null;
  }

  return (
    <HStack align="center">
      {totalDuration && (
        <Tooltip content={t('totalDurationTooltip')}>
          <Typography variant="body4" color="muted">
            {formatSmallDuration(totalDuration * 1000000)}
          </Typography>
        </Tooltip>
      )}
      <ViewMessageTrace
        showAgentMetadata={false}
        agentId={agentId}
        trigger={trigger}
        traceId={stepDetails?.trace_id}
      />
    </HStack>
  );
}

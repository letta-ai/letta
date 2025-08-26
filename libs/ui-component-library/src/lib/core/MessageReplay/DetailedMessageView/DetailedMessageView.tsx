import React, { useMemo } from 'react';
import { VStack } from '../../../framing/VStack/VStack';
import {
  useStepsServiceRetrieveStep,
  useTelemetryServiceRetrieveProviderTrace,
} from '@letta-cloud/sdk-core';
import { get } from 'lodash-es';
import { RequestEvent } from './RequestEvent/RequestEvent';
import { ResponseEvent } from './ResponseEvent/ResponseEvent';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

interface TelemetryDetailsViewerProps {
  stepId: string;
}

export function TelemetryDetailsViewer(props: TelemetryDetailsViewerProps) {
  const { stepId } = props;

  const { data } = useTelemetryServiceRetrieveProviderTrace({
    stepId,
  });

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

  const inputTokens = useMemo(() => {
    if (!data) return undefined;

    const maybeInputTokens = get(
      data,
      'response_json.usage.input_tokens',
      '',
    ) as number | string;

    if (typeof maybeInputTokens === 'number') {
      return maybeInputTokens;
    }

    return undefined;
  }, [data]);

  return (
    <VStack gap={false}>
      <RequestEvent
        stepId={stepId}
        inputTokens={inputTokens}
        requestPayload={data?.request_json || {}}
        responsePayload={data?.response_json || {}}
      />
      <ResponseEvent
        stepId={stepId}
        traces={traceData?.body || []}
        responsePayload={data?.response_json || {}}
        stopReason={stepDetails?.stop_reason || ''}
      />
    </VStack>
  );
}

interface DetailedMessageViewProps {
  stepId: string;
}

export function DetailedMessageView(props: DetailedMessageViewProps) {
  const { stepId } = props;

  return <TelemetryDetailsViewer stepId={stepId} />;
}

import React, { useMemo } from 'react';
import {
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  useStepsServiceRetrieveStep,
  useTelemetryServiceRetrieveProviderTrace,
} from '@letta-cloud/sdk-core';
import { useCurrentAgentMetaData } from '../../../hooks';
import { get } from 'lodash-es';
import { RequestEvent } from './RequestEvent/RequestEvent';
import { ResponseEvent } from './ResponseEvent/ResponseEvent';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';

interface TelemetryDetailsViewerProps {
  stepId: string;
}

export function TelemetryDetailsViewer(props: TelemetryDetailsViewerProps) {
  const { stepId } = props;

  const { isLocal } = useCurrentAgentMetaData();
  const { data } = useTelemetryServiceRetrieveProviderTrace({
    stepId,
  });

  const { data: stepDetails } = useStepsServiceRetrieveStep(
    {
      stepId,
    },
    undefined,
    {
      enabled: !isLocal,
    },
  );

  const { data: traceData } = webApi.traces.getTrace.useQuery({
    queryKey: webApiQueryKeys.traces.getTrace(stepDetails?.trace_id || ''),
    queryData: {
      params: {
        traceId: stepDetails?.trace_id || '',
      },
    },
    enabled: !!stepDetails?.trace_id && !isLocal,
  });

  const inputTokens = useMemo(() => {
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

  if (!data) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  return (
    <VStack gap={false}>
      <RequestEvent
        stepId={stepId}
        inputTokens={inputTokens}
        requestPayload={data.request_json}
      />
      <ResponseEvent
        stepId={stepId}
        traces={traceData?.body || []}
        responsePayload={data.response_json}
      />
    </VStack>
  );
}

interface DetailedMessageViewProps {
  stepId: string;
}

export function DetailedMessageView(props: DetailedMessageViewProps) {
  const { stepId } = props;

  return (
    <VStack
      border
      gap={false}
      overflow="auto"
      color="background"
      className="rounded-b-md"
    >
      <TelemetryDetailsViewer stepId={stepId} />
    </VStack>
  );
}

import React, { useMemo } from 'react';
import {
  Badge,
  Button,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeIcon,
  DetailedMessageView,
  EventDurationsBadge,
  HStack,
  Tooltip,
  Typography,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { FeedbackButtons } from '../FeedbackButtons/FeedbackButtons';
import { useStepsServiceRetrieveStep } from '@letta-cloud/sdk-core';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import { cn } from '@letta-cloud/ui-styles';
import type { AgentSimulatorMessageType } from '../../AgentSimulator/types';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useCurrentAgentMetaData } from '../../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useTraceStepDetails } from '../useTraceStepDetails/useTraceStepDetails';
import { useStepDuration } from '@letta-cloud/utils-client';
import {
  getLLMDurationFromTrace,
  getToolDurationFromTrace,
} from '@letta-cloud/utils-shared';
import { ModifyToolBehaviorPopover } from '../ModifyToolBehaviorPopover/ModifyToolBehaviorPopover';
import { CopyMessageContentButton } from '../CopyMessageContentButton/CopyMessageContentButton';
import { ViewMessageTrace } from '../../../ViewMessageTrace/ViewMessageTrace';

interface StepDetailBarProps {
  message: AgentSimulatorMessageType;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
}

export function StepDetailBar(props: StepDetailBarProps) {
  const { message, setShowDetails, showDetails } = props;
  const t = useTranslations('components/Messages');
  const { isLocal, agentId } = useCurrentAgentMetaData();

  const { stepId, timestamp } = message;

  const { data: stepDetails } = useStepsServiceRetrieveStep(
    {
      stepId: stepId || '',
    },
    undefined,
    {
      enabled: !!stepId,
    },
  );

  const { data: traceData } = webApi.traces.getTrace.useQuery({
    queryKey: webApiQueryKeys.traces.getTrace(stepDetails?.trace_id || ''),
    queryData: {
      params: {
        traceId: stepDetails?.trace_id || '',
      },
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!stepDetails?.trace_id && !isLocal,
  });

  const traceDetails = useTraceStepDetails(stepId || '', traceData?.body || []);
  const stepDuration = useStepDuration(traceDetails);

  const { formatTime, formatSmallDuration } = useFormatters();

  const llmDuration = useMemo(() => {
    return getLLMDurationFromTrace(traceDetails);
  }, [traceDetails]);

  const toolDuration = useMemo(() => {
    return getToolDurationFromTrace(traceDetails);
  }, [traceDetails]);

  if (!message.stepId) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          'w-full messages-step-detail justify-between h-[16px] gap-1 items-center flex pb-1 pt-4',
        )}
      >
        <HStack align="center" gap="small">
          <HStack gap={false} align="center">
            {stepId && (
              <HStack paddingRight="xxsmall">
                <Button
                  preIcon={
                    !showDetails ? (
                      <ChevronDownIcon size="small" />
                    ) : (
                      <ChevronUpIcon size="small" />
                    )
                  }
                  onClick={() => {
                    setShowDetails(!showDetails);
                  }}
                  size="3xsmall"
                  hideLabel
                  square
                  active={showDetails}
                  _use_rarely_className="w-4 h-4 text-muted hover:text-brand"
                  label={showDetails ? t('details.hide') : t('details.show')}
                  color="tertiary"
                />
              </HStack>
            )}
            <HStack gap="small">
              {!!message.toolName && (
                <ModifyToolBehaviorPopover toolName={message.toolName} />
              )}
              {message.raw && (
                <CopyMessageContentButton message={message.raw} />
              )}
            </HStack>
          </HStack>

          {stepId && <FeedbackButtons stepId={stepId} />}
        </HStack>
        <HStack gap="small" align="center">
          {stepDetails?.stop_reason === 'cancelled' && (
            <>
              <Badge
                size="xsmall"
                content={t('stepWasCancelled')}
                variant="warning"
                preIcon={<WarningIcon size="auto" />}
              />
              <Typography variant="body4" color="muted">
                •
              </Typography>
            </>
          )}
          {stepDetails?.stop_reason &&
            ['error', 'invalid_tool_call', 'no_tool_call'].includes(
              stepDetails?.stop_reason,
            ) &&
            !showDetails && (
              <>
                <button
                  className="contents"
                  onClick={() => {
                    setShowDetails(true);
                  }}
                >
                  <Badge
                    size="xsmall"
                    variant="destructive"
                    preIcon={<WarningIcon size="auto" />}
                    content={t('exploreStopReason')}
                  />
                </button>
                <Typography variant="body4" color="muted">
                  •
                </Typography>
              </>
            )}
          {stepDuration && (
            <>
              <Tooltip content={t('stepDurationTooltip')}>
                <Typography variant="body4" color="muted">
                  {formatSmallDuration(stepDuration * 1000000)}
                </Typography>
              </Tooltip>
              <Typography variant="body4" color="muted">
                •
              </Typography>
            </>
          )}
          <Typography variant="body4" color="muted">
            {formatTime(timestamp, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </Typography>
        </HStack>
      </div>
      {showDetails && stepId && (
        <div className="py-1 pt-4">
          <VStack
            border
            gap={false}
            overflow="auto"
            color="background"
            className="rounded-t-md"
          >
            <DetailedMessageView stepId={stepId} />
            <HStack
              fullWidth
              justify="spaceBetween"
              borderTop
              color="background-grey2"
            >
              {stepId && stepDetails?.trace_id && (
                <ViewMessageTrace
                  showAgentMetadata={false}
                  agentId={agentId}
                  trigger={
                    <Button
                      label={t('traceViewer')}
                      size="xsmall"
                      preIcon={<CodeIcon color="muted" size="auto" />}
                      color="tertiary"
                      _use_rarely_className="muted"
                    />
                  }
                  traceId={stepDetails.trace_id}
                />
              )}
              <EventDurationsBadge
                stepDuration={stepDuration}
                llmDuration={llmDuration}
                toolDuration={toolDuration}
              />
            </HStack>
          </VStack>
        </div>
      )}
    </>
  );
}

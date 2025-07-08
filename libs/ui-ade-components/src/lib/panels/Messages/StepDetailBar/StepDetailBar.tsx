import React from 'react';
import {
  Button,
  ChevronDownIcon,
  ChevronUpIcon,
  HStack,
  Typography,
} from '@letta-cloud/ui-component-library';
import { FeedbackButtons } from '../FeedbackButtons/FeedbackButtons';
import { DetailedMessageView } from '../DetailedMessageView/DetailedMessageView';
import { useTelemetryServiceRetrieveProviderTrace } from '@letta-cloud/sdk-core';
import { useFormatters } from '@letta-cloud/utils-client';
import { getIfUsage } from '../DetailedMessageView/ResponseEvent/ResponseEvent';
import { useTranslations } from '@letta-cloud/translations';
import { cn } from '@letta-cloud/ui-styles';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface StepDetailBarProps {
  timestamp: string;
  stepId: string;
  showDetails: boolean;
  setShowDetails: (show: boolean) => void;
}

export function StepDetailBar(props: StepDetailBarProps) {
  const { timestamp, stepId, setShowDetails, showDetails } = props;
  const t = useTranslations('components/Messages');

  const { data: enabled } = useFeatureFlag('DETAILED_MESSAGE_VIEW');

  const { data: stepDetails } = useTelemetryServiceRetrieveProviderTrace(
    {
      stepId,
    },
    undefined,
    {
      enabled,
    },
  );

  const { formatTime } = useFormatters();

  const usage = getIfUsage(stepDetails?.response_json?.usage);

  if (!enabled) {
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
            _use_rarely_className="text-muted w-4 h-4"
            label={showDetails ? t('details.hide') : t('details.show')}
            color="tertiary"
          />
          <FeedbackButtons stepId={stepId} />
        </HStack>
        <HStack gap="small">
          <Typography
            className="messages-step-detail--timestamp"
            variant="body4"
            color="muted"
          >
            {formatTime(timestamp, {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </Typography>
          <Typography
            className="messages-step-detail--timestamp"
            variant="body4"
            color="muted"
          >
            {usage?.output_tokens &&
              t('tokens', {
                count: usage.output_tokens,
              })}
          </Typography>
        </HStack>
      </div>
      {showDetails && (
        <div className="py-1 pt-4">
          <DetailedMessageView stepId={stepId} />
        </div>
      )}
    </>
  );
}

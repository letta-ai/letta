import type { Step } from '@letta-cloud/sdk-core';
import {
  useStepsServiceAddFeedback,
  useStepsServiceRetrieveStep,
  UseStepsServiceRetrieveStepKeyFn,
} from '@letta-cloud/sdk-core';
import React, { useCallback } from 'react';
import {
  Button,
  ThumbsDownIcon,
  ThumbsUpIcon,
  toast,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useQueryClient } from '@tanstack/react-query';

interface FeedbackButtonsProps {
  stepId: string;
}

export function FeedbackButtons(props: FeedbackButtonsProps) {
  const { stepId } = props;

  const t = useTranslations('ADE/AgentSimulator.FeedbackButtons');
  const { data: step } = useStepsServiceRetrieveStep({
    stepId,
  });

  const queryClient = useQueryClient();
  const { mutate } = useStepsServiceAddFeedback();

  const handleAddFeedback = useCallback(
    (feedback: 'negative' | 'positive') => {
      mutate(
        {
          stepId,
          feedback,
        },
        {
          onSuccess: () => {
            queryClient.setQueriesData<Step>(
              {
                queryKey: UseStepsServiceRetrieveStepKeyFn({
                  stepId,
                }),
              },
              (oldData) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  ...oldData,
                  feedback,
                };
              },
            );
          },
          onError: () => {
            toast.error(t('error'));
          },
        },
      );
    },
    [mutate, queryClient, stepId, t],
  );

  const isPositiveFeedback = step?.feedback === 'positive';
  const isNegativeFeedback = step?.feedback === 'negative';

  if (!step) {
    return null;
  }

  return (
    <>
      <Button
        preIcon={<ThumbsUpIcon size="auto" />}
        size="3xsmall"
        hideLabel
        square
        label={t('positive')}
        _use_rarely_className={
          isPositiveFeedback ? 'text-positive' : 'text-muted'
        }
        onClick={() => {
          handleAddFeedback('positive');
        }}
        color="tertiary"
      />
      <Button
        preIcon={<ThumbsDownIcon size="auto" />}
        onClick={() => {
          handleAddFeedback('negative');
        }}
        label={t('negative')}
        size="3xsmall"
        _use_rarely_className={
          isNegativeFeedback ? 'text-destructive' : 'text-muted'
        }
        hideLabel
        square
        color="tertiary"
      />
    </>
  );
}

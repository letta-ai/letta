import type { Step } from '@letta-cloud/sdk-core';
import {
  useStepsServiceAddFeedback,
  useStepsServiceRetrieveStep,
  UseStepsServiceRetrieveStepKeyFn,
} from '@letta-cloud/sdk-core';
import React, { useCallback } from 'react';
import {
  Button,
  HStack,
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
      let previousFeedback: Step['feedback'];

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

          previousFeedback = oldData.feedback;

          return {
            ...oldData,
            feedback,
          };
        },
      );

      mutate(
        {
          stepId,
          feedback,
        },
        {
          onError: () => {
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
                  feedback: previousFeedback,
                };
              },
            );

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
    <HStack gap={false}>
      <Button
        preIcon={
          isPositiveFeedback ? (
            <ThumbsUpIcon color="positive" size="auto" />
          ) : (
            <ThumbsUpIcon color="muted" size="auto" />
          )
        }
        size="3xsmall"
        hideLabel
        square
        label={t('positive')}
        onClick={() => {
          handleAddFeedback('positive');
        }}
        _use_rarely_className=" w-4 min-h-4"
        color="tertiary"
      />
      <Button
        preIcon={
          isNegativeFeedback ? (
            <ThumbsDownIcon color="destructive" size="auto" />
          ) : (
            <ThumbsDownIcon color="muted" size="auto" />
          )
        }
        onClick={() => {
          handleAddFeedback('negative');
        }}
        label={t('negative')}
        size="3xsmall"
        hideLabel
        square
        _use_rarely_className=" w-4 min-h-4"
        color="tertiary"
      />
    </HStack>
  );
}

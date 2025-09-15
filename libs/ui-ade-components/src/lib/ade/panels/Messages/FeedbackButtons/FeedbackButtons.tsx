import type { Step } from '@letta-cloud/sdk-core';
import {
  useStepsServiceModifyFeedbackForStep,
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
import { cn } from '@letta-cloud/ui-styles';

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
  const { mutate } = useStepsServiceModifyFeedbackForStep();

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
          requestBody: {
            feedback,
          },
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
    <HStack gap="small">
      <Button
        preIcon={
          isPositiveFeedback ? (
            <ThumbsUpIcon color="positive" size="auto" />
          ) : (
            <ThumbsUpIcon size="auto" />
          )
        }
        size="3xsmall"
        hideLabel
        square
        label={t('positive')}
        onClick={() => {
          handleAddFeedback('positive');
        }}
        _use_rarely_className={cn(
          "w-4 min-h-4",
          !isPositiveFeedback && "text-muted hover:text-brand"
        )}
        color="tertiary"
      />
      <Button
        preIcon={
          isNegativeFeedback ? (
            <ThumbsDownIcon color="destructive" size="auto" />
          ) : (
            <ThumbsDownIcon size="auto" />
          )
        }
        onClick={() => {
          handleAddFeedback('negative');
        }}
        label={t('negative')}
        size="3xsmall"
        hideLabel
        square
        _use_rarely_className={cn(
          "w-4 min-h-4",
          !isNegativeFeedback && "text-muted hover:text-brand"
        )}
        color="tertiary"
      />
    </HStack>
  );
}

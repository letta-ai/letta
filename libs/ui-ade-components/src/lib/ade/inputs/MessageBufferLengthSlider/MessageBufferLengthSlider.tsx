import { useCurrentGroup } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  HStack,
  InfoTooltip,
  RangeSlider,
  toast,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  UseGroupsServiceRetrieveGroupKeyFn,
  useGroupsServiceModifyGroup,
  type Group,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';

export function MessageBufferLengthSlider() {
  const currentGroup = useCurrentGroup();
  const t = useTranslations('ADE/AdvancedSettings');
  const queryClient = useQueryClient();

  const defaultMin = 15;
  const defaultMax = 30;
  const absoluteMin = 4;
  const absoluteMax = 256;

  const [draftMinBufferLength, setDraftMinBufferLength] =
    useState<number>(defaultMin);
  const [draftMaxBufferLength, setDraftMaxBufferLength] =
    useState<number>(defaultMax);

  // For debouncing API calls
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentGroup) {
      const hasChanges =
        (currentGroup.min_message_buffer_length !== undefined &&
          currentGroup.min_message_buffer_length !== draftMinBufferLength) ||
        (currentGroup.max_message_buffer_length !== undefined &&
          currentGroup.max_message_buffer_length !== draftMaxBufferLength);

      if (hasChanges) {
        setDraftMinBufferLength(
          currentGroup.min_message_buffer_length || defaultMin,
        );
        setDraftMaxBufferLength(
          currentGroup.max_message_buffer_length || defaultMax,
        );
      }
    }
  }, [currentGroup, draftMinBufferLength, draftMaxBufferLength]);

  const { mutate: updateGroup } = useGroupsServiceModifyGroup({
    onSuccess: () => {
      if (!currentGroup) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: UseGroupsServiceRetrieveGroupKeyFn({
          groupId: currentGroup.id,
        }),
      });
    },
    onError: () => {
      setDraftMinBufferLength(
        currentGroup?.min_message_buffer_length || defaultMin,
      );
      setDraftMaxBufferLength(
        currentGroup?.max_message_buffer_length || defaultMax,
      );
      toast.error(t('MessageBufferLengthSlider.error'));
    },
  });

  const updateLocalCache = useCallback(
    (minValue: number, maxValue: number) => {
      if (!currentGroup?.id) return;

      queryClient.setQueryData(
        UseGroupsServiceRetrieveGroupKeyFn({
          groupId: currentGroup.id,
        }),
        (oldData: Group | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            min_message_buffer_length: minValue,
            max_message_buffer_length: maxValue,
          };
        },
      );
    },
    [currentGroup, queryClient],
  );

  const handleBufferLengthChange = useCallback(
    (minValue: number, maxValue: number) => {
      if (!currentGroup?.id) return;

      updateLocalCache(minValue, maxValue);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        updateGroup({
          groupId: currentGroup.id,
          requestBody: {
            manager_config: {
              manager_type: 'voice_sleeptime',
              min_message_buffer_length: minValue,
              max_message_buffer_length: maxValue,
            },
          },
        });
      }, 500);
    },
    [currentGroup, updateGroup, updateLocalCache],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const isValidRange = useMemo(() => {
    return (
      draftMinBufferLength >= absoluteMin &&
      draftMaxBufferLength >= absoluteMin &&
      draftMinBufferLength <= absoluteMax &&
      draftMaxBufferLength <= absoluteMax &&
      draftMinBufferLength < draftMaxBufferLength
    );
  }, [draftMinBufferLength, draftMaxBufferLength]);

  return (
    <VStack gap="large" fullWidth className="pb-6">
      <HStack align="center">
        <Typography variant="body2">
          {t('MessageBufferLengthSlider.label')}
        </Typography>
        <InfoTooltip text={t('MessageBufferLengthSlider.tooltip')} />
      </HStack>
      <RangeSlider
        fullWidth
        labelPosition="bottom"
        values={[draftMinBufferLength, draftMaxBufferLength]}
        errorMessage={
          !isValidRange ? t('MessageBufferLengthSlider.rangeError') : undefined
        }
        onValueChange={(values) => {
          const newMinValue = values[0];
          const newMaxValue = values[1];

          if (isValidRange) {
            setDraftMinBufferLength(newMinValue);
            setDraftMaxBufferLength(newMaxValue);
            handleBufferLengthChange(newMinValue, newMaxValue);
          }
        }}
        min={absoluteMin}
        max={absoluteMax}
      />
    </VStack>
  );
}

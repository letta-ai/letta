import type { HiddenReasoningMessage } from '@letta-cloud/sdk-core';
import {
  BlockQuote,
  HStack,
  InnerMonologueIcon,
  Typography,
  VStack
} from '@letta-cloud/ui-component-library';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';

interface InteractiveHiddenReasoningMessageProps {
  message: HiddenReasoningMessage;
}

export function InteractiveHiddenReasoningMessage(props: InteractiveHiddenReasoningMessageProps) {
  const t = useTranslations('components/Messages');
  const { message } = props;
  const { state } = message;

  // Hidden reasoning messages should not be editable since they're system-generated
  // and the content is either omitted or redacted by the model provider

  return (
    <BlockQuote fullWidth>
      <HStack fullWidth align="start">
        <VStack fullWidth gap="small">
          <HStack align="center" gap="small">
            <InnerMonologueIcon color="violet" size="small" />
            <Typography semibold color="violet" variant="body3">
              {t('reasoning')}
            </Typography>
          </HStack>
          <Typography
            semibold
            uppercase
            variant="body3"
            color="muted"
          >
            {state === 'omitted'
              ? t('hiddenByModelProvider')
              : t('redactedByModelProvider')}
          </Typography>
        </VStack>
      </HStack>
    </BlockQuote>
  );
}

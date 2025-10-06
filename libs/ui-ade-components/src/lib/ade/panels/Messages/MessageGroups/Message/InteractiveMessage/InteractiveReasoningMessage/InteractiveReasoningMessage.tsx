import type { ReasoningMessage } from '@letta-cloud/sdk-core';
import {
  BlockQuote,
  HStack,
  InnerMonologueIcon,
  Tooltip,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { EditMessageButton } from '../../EditMessageButton/EditMessageButton';

interface InteractiveReasoningMessageProps {
  message: ReasoningMessage;
}

export function InteractiveReasoningMessage(
  props: InteractiveReasoningMessageProps,
) {
  const t = useTranslations('components/Messages');
  const { message } = props;
  const { reasoning, source } = message;
  if (!reasoning) {
    return null;
  }
  return (
    <BlockQuote fullWidth>
      <HStack fullWidth align="start">
        <VStack fullWidth gap="small">
          <HStack align="center" justify="spaceBetween">
            <HStack align="center" gap="small">
              {source === 'reasoner_model' ? (
                <Tooltip content={t('reasonerModel')}>
                  <HStack align="center">
                    <InnerMonologueIcon color="violet" size="small" />
                  </HStack>
                </Tooltip>
              ) : (
                <InnerMonologueIcon color="violet" size="small" />
              )}

              <Typography semibold color="violet" variant="body3">
                {t('reasoning')}
              </Typography>
            </HStack>
          </HStack>
          <Typography
            className="whitespace-pre-wrap"
            color="lighter"
            variant="body3"
          >
            {reasoning}
          </Typography>
        </VStack>
        <EditMessageButton />
      </HStack>
    </BlockQuote>
  );
}

import type { ReasoningMessage } from '@letta-cloud/sdk-core';
import {
  AnthropicLogoMarkDynamic,
  BlockQuote,
  HStack,
  InnerMonologueIcon,
  Tooltip,
  Typography,
  VStack
} from '@letta-cloud/ui-component-library';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { EditMessageButton } from '../../EditMessageButton/EditMessageButton';

interface InteractiveReasoningMessageProps {
  message: ReasoningMessage
}

export function InteractiveReasoningMessage(props: InteractiveReasoningMessageProps) {
  const t = useTranslations('components/Messages');
  const { message } = props;
  const { reasoning, source } = message;
  return (
    <BlockQuote fullWidth>
      <HStack fullWidth align="start">
        <VStack fullWidth gap="small">
          <HStack align="center" justify="spaceBetween">
            <HStack align="center" gap="small">
              <InnerMonologueIcon color="violet" size="small" />
              <Typography semibold color="violet" variant="body3">
                {t('reasoning')}
              </Typography>
            </HStack>
            {source === 'reasoner_model' && (
              <div className="pr-8">
                <Tooltip content={t('reasonerModel')}>
                  <AnthropicLogoMarkDynamic
                    color="violet"
                    size="small"
                    className="opacity-60"
                  />
                </Tooltip>
              </div>
            )}
          </HStack>
          <Typography color="lighter" variant="body3">
            {reasoning}
          </Typography>
        </VStack>
        <EditMessageButton />
      </HStack>

    </BlockQuote>
  )

}

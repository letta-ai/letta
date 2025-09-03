import { CopyButton } from '@letta-cloud/ui-component-library';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';

interface CopyMessageContentButtonProps {
  message: string
}

export function CopyMessageContentButton(props: CopyMessageContentButtonProps) {
  const t = useTranslations('ADE/AgentSimulator.CopyMessageContentButton');
  const { message } = props;
  return (
    <CopyButton
      textToCopy={message || ''}
      copyButtonText={t('copy')}
      copiedText={t('copied')}
      size="2xsmall"
      hideLabel
      square
      color="tertiary"
      _use_rarely_className="text-muted hover:text-brand"
    />
  )
}

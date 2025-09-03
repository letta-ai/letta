import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { RawSwitch } from '@letta-cloud/ui-component-library';
import React from 'react';

export function MessageBufferAutoclearSwitch() {
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();
  const t = useTranslations('ADE/AdvancedSettings');

  return (
    <RawSwitch
      fullWidth
      name="messageBufferAutoclear"
      label={t('AdvancedSettingsPanel.messageBufferAutoclear.label')}
      infoTooltip={{
        text: t('AdvancedSettingsPanel.messageBufferAutoclear.tooltip'),
      }}
      checked={currentAgent.message_buffer_autoclear || false}
      onCheckedChange={(checked) => {
        syncUpdateCurrentAgent((existing) => ({
          ...existing,
          message_buffer_autoclear: checked,
        }));
      }}
    />
  );
}

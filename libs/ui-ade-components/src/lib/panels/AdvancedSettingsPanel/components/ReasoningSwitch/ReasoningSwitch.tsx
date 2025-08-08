import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { RawSwitch } from '@letta-cloud/ui-component-library';

export function ReasoningSwitch() {
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent({ refreshOnSuccess: true });
  const t = useTranslations('ADE/AdvancedSettings');

  return (
    <RawSwitch
      fullWidth
      name="reasoning"
      label={t('AdvancedSettingsPanel.reasoning.label')}
      infoTooltip={{
        text: t('AdvancedSettingsPanel.reasoning.tooltip'),
      }}
      checked={currentAgent.llm_config?.enable_reasoner || currentAgent.llm_config?.put_inner_thoughts_in_kwargs || false}
      onCheckedChange={(checked) => {
        syncUpdateCurrentAgent((existing) => ({
          ...existing,
          llm_config: {
            ...existing.llm_config,
            enable_reasoner: checked,
            put_inner_thoughts_in_kwargs: checked,
          },
        }));
      }}
    />
  );
}

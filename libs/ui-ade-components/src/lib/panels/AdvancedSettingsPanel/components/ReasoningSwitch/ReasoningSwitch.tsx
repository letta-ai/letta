import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { RawSwitch } from '@letta-cloud/ui-component-library';

export function ReasoningSwitch() {
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent({ refreshOnSuccess: true });
  const t = useTranslations('ADE/AdvancedSettings');

  const modelEndpointType = currentAgent.llm_config?.model_endpoint_type;
  const model = currentAgent.llm_config?.model;

  const disableSwitch =
    (modelEndpointType?.startsWith('openai') &&
      (model?.startsWith('o1') || model?.startsWith('o3') || model?.startsWith('o4') || model?.startsWith('gpt-5'))) ||
    (modelEndpointType?.startsWith('google_vertex') &&
      model?.startsWith('gemini-2.5-pro'));

  return (
    <RawSwitch
      fullWidth
      name="reasoning"
      label={t('AdvancedSettingsPanel.reasoning.label')}
      infoTooltip={{
        text: disableSwitch
          ? t('AdvancedSettingsPanel.reasoning.disabledTooltip')
          : t('AdvancedSettingsPanel.reasoning.tooltip'),
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
      disabled={disableSwitch}
    />
  );
}

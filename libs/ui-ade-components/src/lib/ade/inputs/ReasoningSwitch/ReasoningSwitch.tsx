import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { RawSwitch } from '@letta-cloud/ui-component-library';

export function ReasoningSwitch() {
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent({ refreshOnSuccess: true });
  const t = useTranslations('ADE/AdvancedSettings');

  const modelEndpointType = currentAgent.llm_config?.model_endpoint_type;
  const model = currentAgent.llm_config?.model;
  const isLettaV1Agent = currentAgent?.agent_type === 'letta_v1_agent';

  // Reasoner detection mirrors backend helpers
  const isOpenAIReasoner =
    (modelEndpointType?.startsWith('openai') &&
      (model?.startsWith('o1') || model?.startsWith('o3') || model?.startsWith('o4') || model?.startsWith('gpt-5')));
  const isAnthropicReasoner =
    (modelEndpointType?.startsWith('anthropic') &&
      (model?.startsWith('claude-3-7-sonnet') || model?.startsWith('claude-sonnet-4') || model?.startsWith('claude-opus-4')));
  const isGoogleReasoner =
    ((modelEndpointType?.startsWith('google_vertex') || modelEndpointType?.startsWith('google_ai')) &&
      model?.startsWith('gemini-2.5-flash'));
  // For letta_v1_agent, we treat Gemini as not supported (TODO native reasoning support later)
  const supportsReasoningInV1 = isOpenAIReasoner || isAnthropicReasoner || isGoogleReasoner;

  const disableSwitch = isLettaV1Agent
    ? !supportsReasoningInV1
    : (
        (modelEndpointType?.startsWith('openai') &&
          (model?.startsWith('o1') || model?.startsWith('o3') || model?.startsWith('o4') || model?.startsWith('gpt-5')))
        || (modelEndpointType?.startsWith('google_vertex') && model?.startsWith('gemini-2.5-pro'))
      );

  const infoTooltipText = isLettaV1Agent
    ? (isOpenAIReasoner
        ? t('AdvancedSettingsPanel.reasoning.disabledTooltip') // cannot disable
        : supportsReasoningInV1
          ? t('AdvancedSettingsPanel.reasoning.tooltip') // togglable
          : t('AdvancedSettingsPanel.reasoning.v1Unsupported'))
    : (disableSwitch
        ? t('AdvancedSettingsPanel.reasoning.disabledTooltip')
        : t('AdvancedSettingsPanel.reasoning.tooltip'));

  return (
    <RawSwitch
      fullWidth
      name="reasoning"
      label={t('AdvancedSettingsPanel.reasoning.label')}
      infoTooltip={{ text: infoTooltipText }}
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

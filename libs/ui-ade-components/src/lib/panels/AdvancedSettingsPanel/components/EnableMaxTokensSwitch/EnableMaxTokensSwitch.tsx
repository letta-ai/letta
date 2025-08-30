import { useCurrentAgent, useSyncUpdateCurrentAgent } from '../../../../hooks';
import { RawSwitch } from '@letta-cloud/ui-component-library';

interface EnableMaxTokensSwitchProps {
  defaultMaxTokens?: number;
}

export function EnableMaxTokensSwitch({ defaultMaxTokens = 4096 }: EnableMaxTokensSwitchProps) {
  const currentAgent = useCurrentAgent();
  const { syncUpdateCurrentAgent } = useSyncUpdateCurrentAgent();

  const isEnabled = currentAgent.llm_config?.max_tokens !== null &&
                    currentAgent.llm_config?.max_tokens !== undefined;

  return (
    <RawSwitch
      fullWidth
      id="enable-max-tokens"
      name="enable-max-tokens"
      data-testid="switch:enable-max-tokens"
      label="Enable max output tokens"
      infoTooltip={{
        text: "When enabled, limits the maximum number of tokens the model can generate in a single response",
      }}
      checked={isEnabled}
      onCheckedChange={(checked) => {
        syncUpdateCurrentAgent((existing) => ({
          ...existing,
          llm_config: {
            ...existing.llm_config,
            max_tokens: checked ? defaultMaxTokens : null,
          },
        }));
      }}
    />
  );
}

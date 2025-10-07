import { MaxReasoningTokensSlider } from './MaxReasoningTokensSlider';
import type { LLMConfig } from '@letta-cloud/sdk-core';

interface MaxReasoningTokensSliderContainerProps {
  llmConfig: LLMConfig;
  maxTokens?: number | null;
}

export function MaxReasoningTokensSliderContainer(props: MaxReasoningTokensSliderContainerProps) {
  const { llmConfig, maxTokens } = props;

  const modelEndpointType = llmConfig?.model_endpoint_type;
  const model = llmConfig?.model;

  const isAnthropicReasoner =
    (modelEndpointType?.startsWith('anthropic') &&
      (model?.startsWith('claude-3-7-sonnet') ||
        model?.startsWith('claude-sonnet-4') ||
        model?.startsWith('claude-opus-4')));
  const isGoogleReasoner =
    ((modelEndpointType?.startsWith('google_vertex') ||
      modelEndpointType?.startsWith('google_ai')) &&
      model?.startsWith('gemini-2.5-flash'));

  if (
    maxTokens &&
    (isAnthropicReasoner || isGoogleReasoner)
  ) {
    return (
      <MaxReasoningTokensSlider
        maxTokens={
          llmConfig.max_tokens || maxTokens
        }
        defaultMaxReasoningTokens={
          llmConfig.max_reasoning_tokens || 0
        }
      />
    );
  }

  return null;
}

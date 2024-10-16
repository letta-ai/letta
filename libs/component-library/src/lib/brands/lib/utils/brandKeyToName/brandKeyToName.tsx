import type { LLMConfig } from '@letta-web/letta-agents-api';
import React from 'react';
import { OpenAILogo } from '../../open-ai/OpenAILogo/OpenAILogo';

const brandKeyToNameMap: Record<LLMConfig['model_endpoint_type'], string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  cohere: 'Cohere',
  google_ai: 'Google AI',
  azure: 'Azure',
  groq: 'Groq',
  ollama: 'Ollama',
  webui: 'WebUI',
  'webui-legacy': 'WebUI Legacy',
  lmstudio: 'LM Studio',
  'lmstudio-legacy': 'LM Studio Legacy',
  llamacpp: 'LLamaCPP',
  koboldcpp: 'KoboldCPP',
  vllm: 'VLLM',
  'hugging-face': 'Hugging Face',
  mistral: 'Mistral',
};

export function isBrandKey(
  brandKey: string
): brandKey is LLMConfig['model_endpoint_type'] {
  return brandKey in brandKeyToNameMap;
}

export function brandKeyToName(brandKey: LLMConfig['model_endpoint_type']) {
  return brandKeyToNameMap[brandKey];
}

const brandKeyToLogoMap: Record<
  LLMConfig['model_endpoint_type'],
  React.ReactNode
> = {
  openai: <OpenAILogo />,
  anthropic: '',
  cohere: '',
  google_ai: '',
  azure: '',
  groq: '',
  ollama: '',
  webui: '',
  'webui-legacy': '',
  lmstudio: '',
  'lmstudio-legacy': '',
  llamacpp: '',
  koboldcpp: '',
  vllm: '',
  'hugging-face': '',
  mistral: '',
};

export function brandKeyToLogo(brandKey: LLMConfig['model_endpoint_type']) {
  return brandKeyToLogoMap[brandKey];
}

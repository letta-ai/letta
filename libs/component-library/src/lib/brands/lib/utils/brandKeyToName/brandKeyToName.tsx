import type { LLMConfig } from '@letta-web/letta-agents-api';
import React from 'react';
import { OpenAILogo } from '../../open-ai/OpenAILogo/OpenAILogo';
import { HuggingFaceLogo } from '../../hugging-face/HuggingFaceLogo/HuggingFaceLogo';
import { ComposIOLogo } from '../../composio/ComposIOLogo/ComposIOLogo';
import { CrewAILogo } from '../../crew-ai/CrewAILogo/CrewAILogo';
import { LangChainLogo } from '../../langchain/LangChainLogo/LangChainLogo';
import { Logo } from '../../../../marketing/Logo/Logo';

type BrandKeys =
  | LLMConfig['model_endpoint_type']
  | 'composio'
  | 'crew-ai'
  | 'langchain'
  | 'letta';

export const brandKeyToNameMap: Record<BrandKeys, string> = {
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
  composio: 'ComposIO',
  'crew-ai': 'Crew AI',
  langchain: 'LangChain',
  letta: 'Letta',
};

export function isBrandKey(brandKey: string): brandKey is BrandKeys {
  return brandKey in brandKeyToNameMap;
}

export function brandKeyToName(brandKey: BrandKeys) {
  return brandKeyToNameMap[brandKey];
}

const brandKeyToLogoMap: Record<BrandKeys, React.ReactNode> = {
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
  'hugging-face': <HuggingFaceLogo />,
  mistral: '',
  composio: <ComposIOLogo />,
  'crew-ai': <CrewAILogo />,
  langchain: <LangChainLogo />,
  letta: <Logo />,
};

export function brandKeyToLogo(brandKey: BrandKeys) {
  return brandKeyToLogoMap[brandKey];
}

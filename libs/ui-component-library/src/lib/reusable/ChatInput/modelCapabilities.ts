export const MODELS_WITH_IMAGE_SUPPORT = [
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-20241022',
  'claude-3-7-sonnet-20250219',
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5-20250929',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4.1',
  'gpt-4.1-2025-04-14',
  'gpt-4.1-mini',
  'gpt-4.1-mini-2025-04-14',
  'gpt-4.1-nano',
  'gpt-4.1-nano-2025-04-14',
  'gpt-4o',
  'gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20',
  'gpt-4o-mini',
  'gpt-4o-mini-2024-07-18',
  'o1',
  'o1-2024-12-17',
  'o3',
  'o3-2025-04-16',
  'o4-mini',
  'o4-mini-2025-04-16',
  'gemini-1.5-pro',
  'gemini-1.5-pro-002',
  'gemini-1.5-pro-latest',
  'gemini-2.0-flash-thinking-exp',
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.5-pro',
  'gemini-2.5-pro-preview-03-25',
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.5-flash',
  'gemini-2.0-flash-thinking-exp-1219',
  'gemini-2.5-flash-preview-04-17-thinking',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.0-flash-thinking-exp-01-21',
  'qwen/qwen2.5-vl-7b',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gemini-2.5-flash-lite-preview-06-17',
  'arcee-ai/coder-large',
  'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  'Qwen/Qwen2.5-72B-Instruct-Turbo',
  'arcee-ai/virtuoso-large',
  'arcee-ai/virtuoso-medium-v2',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
  'Qwen/QwQ-32B',
  'google/gemma-3n-E4B-it',
  'mistralai/Mistral-7B-Instruct-v0.2',
  'perplexity-ai/r1-1776',
] as const;

export function modelSupportsImages(modelHandle: string | undefined): boolean {
  if (!modelHandle) return true;

  const modelName = modelHandle.split('/').pop() || modelHandle;
  return MODELS_WITH_IMAGE_SUPPORT.includes(modelName as any);
}

export interface ModelCapabilities {
  supportsImages: boolean;
}

export function getModelCapabilities(
  modelHandle: string | undefined,
): ModelCapabilities {
  return {
    supportsImages: modelSupportsImages(modelHandle),
  };
}

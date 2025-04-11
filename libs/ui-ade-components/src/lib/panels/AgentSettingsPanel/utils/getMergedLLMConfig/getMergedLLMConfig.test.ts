import { getMergedLLMConfig } from './getMergedLLMConfig';
import type { LLMConfig } from '@letta-cloud/sdk-core';

describe('getMergedLLMConfig', () => {
  it('should merge configurations and preserve smaller values for preserved keys', () => {
    const newConfig: LLMConfig = {
      temperature: 0.7,
      context_window: 940,
      max_tokens: 1000,
      model: 'gpt-3.5-turbo',
      model_endpoint_type: 'openai',
    };

    const existingConfig: LLMConfig = {
      temperature: 0.5,
      context_window: 1024,
      max_tokens: 500,
      model: 'gpt-3.5-turbo',
      model_endpoint_type: 'openai',
    };

    const result = getMergedLLMConfig(newConfig, existingConfig);

    expect(result).toEqual({
      temperature: 0.5, // taken form existing as it is smaller
      context_window: 940, // taken from newConfig because it is smaller
      max_tokens: 1000, // taken from newConfig
      model: 'gpt-3.5-turbo',
      model_endpoint_type: 'openai',
    });
  });

  it('should use values from newConfig if preserved keys are not in existingConfig', () => {
    const newConfig: LLMConfig = {
      temperature: 0.8,
      context_window: 2048,
      model: 'gpt-3.5-turbo',
      model_endpoint_type: 'openai',
    };

    const existingConfig: LLMConfig = {
      model: 'gpt-3.5-turbo',
      model_endpoint_type: 'openai',
      context_window: 1024,
    };

    const result = getMergedLLMConfig(newConfig, existingConfig);

    expect(result).toEqual({
      temperature: 0.8,
      context_window: 1024,
      model: 'gpt-3.5-turbo',
      model_endpoint_type: 'openai',
    });
  });
});

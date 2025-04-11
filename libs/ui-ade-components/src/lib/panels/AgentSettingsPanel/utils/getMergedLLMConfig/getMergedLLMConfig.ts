import type { LLMConfig } from '@letta-cloud/sdk-core';
import { pick } from 'lodash';

const preservedKeys = ['temperature', 'context_window'];

function isKeyInPreservedKeys(
  key: string,
): key is 'context_window' | 'temperature' {
  return ['temperature', 'context_window'].includes(key);
}

export function getMergedLLMConfig(
  newConfig: LLMConfig,
  existingConfig: LLMConfig,
) {
  const preservedValues = pick(existingConfig, [
    'temperature',
    'context_window',
  ]);
  const valuesInSelectedLLMConfig = Object.keys(newConfig).filter((key) =>
    preservedKeys.includes(key),
  );

  const valuesToUpdate = valuesInSelectedLLMConfig.reduce((acc, key) => {
    // only use preservedValue if it is smaller than the selectedLLMConfig value

    if (!isKeyInPreservedKeys(key)) {
      return acc;
    }

    if (
      typeof preservedValues[key] === 'number' &&
      typeof newConfig[key] === 'number'
    ) {
      if (preservedValues[key] > newConfig[key]) {
        acc[key] = newConfig[key];
        return acc;
      }
    }

    acc[key] = preservedValues[key] || newConfig[key];
    return acc;
  }, {} as Partial<LLMConfig>);

  return {
    ...newConfig,
    ...valuesToUpdate,
  };
}

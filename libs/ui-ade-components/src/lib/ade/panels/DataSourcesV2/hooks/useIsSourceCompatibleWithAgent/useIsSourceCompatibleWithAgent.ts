import type { Source } from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../../../../hooks';
import { useMemo } from 'react';

export function useIsSourceCompatibleWithAgent(source: Source) {
  const { embedding_config } = useCurrentAgent();

  return useMemo(() => {
    if (!embedding_config || !source.embedding_config) {
      return true;
    }

    return (
      embedding_config.embedding_model ===
      source.embedding_config.embedding_model
    );
  }, [embedding_config, source.embedding_config]);
}

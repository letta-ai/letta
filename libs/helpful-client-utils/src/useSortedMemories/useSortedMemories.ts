import type { AgentState, Block } from '@letta-cloud/letta-agents-api';
import { useMemo } from 'react';

export function useSortedMemories(agentState?: Partial<AgentState>): Block[] {
  return useMemo(() => {
    return (agentState?.memory?.blocks || []).toSorted((a, b) => {
      return a.label?.localeCompare(b.label || '') || 0;
    });
  }, [agentState?.memory?.blocks]);
}

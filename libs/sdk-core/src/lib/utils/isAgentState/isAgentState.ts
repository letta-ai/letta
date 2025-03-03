import type { AgentState } from '../../../';

export function isAgentState(state: unknown): state is AgentState {
  return (
    state instanceof Object &&
    'system' in state &&
    'llm_config' in state &&
    'embedding_config' in state &&
    'memory' in state &&
    'tools' in state &&
    'sources' in state
  );
}

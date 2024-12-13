import { z } from 'zod';
import type {
  AgentState,
  CreateAgentRequest,
} from '@letta-web/letta-agents-api';

export const supportedProvidersSchema = z.enum(['google']);

export type SupportedProviders = z.infer<typeof supportedProvidersSchema>;

/**
 * This is the data we want to extract from oauth logins
 */
export interface ProviderUserPayload {
  email: string;
  uniqueId: string;
  imageUrl: string;
  provider: SupportedProviders;
  name: string;
}

export interface AgentTemplate {
  system: AgentState['system'];
  memory_blocks: CreateAgentRequest['memory_blocks'];
  tool_names: AgentState['tool_names'];
  llm_config: AgentState['llm_config'];
  embedding_config: AgentState['embedding_config'];
}

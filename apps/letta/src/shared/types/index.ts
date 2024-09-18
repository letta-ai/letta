import { z } from 'zod';
import type { AgentState } from '@letta-web/letta-agents-api';

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
  memory: AgentState['memory'];
  tools: AgentState['tools'];
  llm_config: AgentState['llm_config'];
  embedding_config: AgentState['embedding_config'];
}

export enum AgentTemplateVariant {
  CUSTOMER_SUPPORT = 'customer_support',
  FANTASY_ROLEPLAY = 'fantasy_roleplay',
  DATA_COLLECTOR = 'data_collector',
  DEFAULT = 'default',
}

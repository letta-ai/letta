import { z } from 'zod';
import type { AgentState } from '@letta-web/letta-agents-api';
import { initContract } from '@ts-rest/core';
export const supportedProvidersSchema = z.enum(['google', 'github']);

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

const c = initContract();

export const VersionedTemplateType = c.type<{
  id: string;
  fullVersion: string;
  version: string;
  state?: AgentState;
}>();

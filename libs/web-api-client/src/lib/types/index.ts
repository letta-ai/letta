import { z } from 'zod';
export const supportedProvidersSchema = z.enum(['google', 'github', 'email']);

export type SupportedProviders = z.infer<typeof supportedProvidersSchema>;

/**
 * This is the data we want to extract from oauth logins
 */
export interface ProviderUserPayload {
  email: string;
  uniqueId: string;
  imageUrl: string;
  provider: SupportedProviders;
  skipOnboarding?: boolean;
  name: string;
}

export * from './user';

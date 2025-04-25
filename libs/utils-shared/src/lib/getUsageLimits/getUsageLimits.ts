import type { BillingTiersType } from '@letta-cloud/types';

export interface Limit {
  agents: number;
  templates: number;
  storage: number; // in bytes
  identities: number;
  projects: number;
  dataSources: number;
  premiumInferencesPerMonth: number;
  freeInferencesPerMonth: number;
}

const OneGB = 1_073_741_824; // 1024 * 1024 * 1024

const limitMap: Record<BillingTiersType, Limit> = {
  enterprise: {
    agents: 50_000_000,
    identities: 10_000_000,
    projects: 10_000,
    dataSources: 5_000_000,
    templates: 2_000,
    premiumInferencesPerMonth: 1_000_000_000_000,
    freeInferencesPerMonth: 1_000_000_000,
    storage: OneGB * 100, // 100 GB
  },
  pro: {
    identities: 1000,
    agents: 1000,
    projects: 100,
    dataSources: 25,
    templates: 100,
    premiumInferencesPerMonth: 5000,
    freeInferencesPerMonth: 10_000_000,
    storage: OneGB, // 1 GB
  },
  free: {
    agents: 25,
    dataSources: 25,
    projects: 25,
    templates: 25,
    identities: 25,
    premiumInferencesPerMonth: 0,
    freeInferencesPerMonth: 100_000,
    storage: OneGB / 10, // 100 MB
  },
};

export function getUsageLimits(billingTier: BillingTiersType) {
  return limitMap[billingTier] || limitMap.free;
}

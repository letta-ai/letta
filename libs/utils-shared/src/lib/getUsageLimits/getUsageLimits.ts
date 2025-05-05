import type { BillingTiersType } from '@letta-cloud/types';

export interface UsageLimits {
  agents: number;
  templates: number;
  storage: number; // in bytes
  identities: number;
  projects: number;
  dataSources: number;
  premiumInferencesPerMonth: number;
  freeInferencesPerMonth: number;
  tools: number;
  fileSize: number; // in bytes
  groups: number;
  blocks: number;
}

const OneGB = 1_073_741_824; // 1024 * 1024 * 1024
const OneHundredMB = 1024 * 1024 * 100; // 100 MB
const TwentyFiveMB = 1024 * 1024 * 25; // 25 MB
const FiveMB = 1024 * 1024 * 5; // 5 MB

const limitMap: Record<BillingTiersType, UsageLimits> = {
  enterprise: {
    agents: 50_000_000,
    identities: 10_000_000,
    projects: 10_000,
    dataSources: 5_000_000,
    templates: 2_000,
    tools: 250,
    blocks: 500_000_000,
    groups: 10,
    fileSize: OneHundredMB, // 100 MB
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
    tools: 250,
    groups: 10,
    blocks: 100_000,
    premiumInferencesPerMonth: 5000,
    freeInferencesPerMonth: 10_000_000,
    fileSize: TwentyFiveMB, // 100 MB
    storage: OneGB, // 1 GB
  },
  free: {
    agents: 25,
    dataSources: 25,
    projects: 25,
    templates: 25,
    blocks: 100,
    tools: 250,
    groups: 10,
    identities: 25,
    premiumInferencesPerMonth: 25,
    freeInferencesPerMonth: 100_000,
    fileSize: FiveMB, // 5 MB
    storage: OneGB / 10, // 100 MB
  },
};

export function getUsageLimits(billingTier: BillingTiersType) {
  return limitMap[billingTier] || limitMap.free;
}

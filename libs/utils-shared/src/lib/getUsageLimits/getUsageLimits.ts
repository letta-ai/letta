import type { BillingTiersType } from '@letta-cloud/types';

export interface UsageLimits {
  providers: number;
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
  monthlyCost: number; // in dollars
  apiKeys: number; // number of API keys allowed
}

const OneGB = 1_073_741_824; // 1024 * 1024 * 1024
const OneHundredMB = 1024 * 1024 * 100; // 100 MB
const TwentyFiveMB = 1024 * 1024 * 25; // 25 MB
const FiveMB = 1024 * 1024 * 5; // 5 MB

const limitMap: Record<BillingTiersType, UsageLimits> = {
  enterprise: {
    monthlyCost: 99999999999,
    providers: 50,
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
    apiKeys: 100_000, // 100,000 API keys
  },
  pro: {
    monthlyCost: 20,
    providers: 50,
    identities: 1000,
    agents: 1000,
    projects: 100,
    dataSources: 1000,
    templates: 20,
    tools: 250,
    groups: 10,
    blocks: 100_000,
    premiumInferencesPerMonth: 500,
    freeInferencesPerMonth: 5_000,
    fileSize: TwentyFiveMB,
    storage: OneGB * 10, // 1 GB
    apiKeys: 1_000, // 100 API keys
  },
  scale: {
    monthlyCost: 750,
    providers: 50,
    identities: 100_000,
    agents: 1_000_000,
    projects: 100,
    dataSources: 1000,
    templates: 100,
    tools: 250,
    groups: 10,
    blocks: 100_000_0000,
    premiumInferencesPerMonth: 5_000,
    freeInferencesPerMonth: 50_000,
    fileSize: TwentyFiveMB,
    storage: OneGB * 100, // 1 GB
    apiKeys: 5_000, // 5,000 API keys
  },
  free: {
    monthlyCost: 0,
    providers: 50,
    agents: 10,
    dataSources: 25,
    projects: 25,
    templates: 10,
    blocks: 5_000,
    tools: 250,
    groups: 1,
    identities: 5,
    premiumInferencesPerMonth: 50,
    freeInferencesPerMonth: 500,
    fileSize: FiveMB, // 5 MB
    storage: OneGB, // 1 GB
    apiKeys: 25,
  },
};

export function getUsageLimits(billingTier: BillingTiersType) {
  return limitMap[billingTier] || limitMap.free;
}

import type { BillingTiersType, PaymentCustomerSubscription } from '@letta-cloud/types';

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
  fileSizePerMinute: number; // in bytes
  groups: number;
  blocks: number;
  monthlyCost: number; // in dollars
  filesPerMinute: number; // in bytes
  apiKeys: number; // number of API keys allowed
  abTests: number; // number of A/B tests allowed
}

const OneGB = 1_073_741_824; // 1024 * 1024 * 1024
const OneHundredMB = 1024 * 1024 * 100; // 100 MB
const TwentyFiveMB = 1024 * 1024 * 25; // 25 MB
const FiveMB = 1024 * 1024 * 5; // 5 MB
const _OneMB = 1024 * 1024; // 1 MB

const limitMap: Record<BillingTiersType, UsageLimits> = {
  enterprise: {
    monthlyCost: 99999999999,
    providers: 50,
    agents: 500_000_000,
    identities: 500_000_000,
    projects: 10_000,
    dataSources: 5_000_000,
    templates: 2_000,
    tools: 300,
    blocks: 500_000_000,
    groups: 10,
    fileSize: OneHundredMB, // 100 MB
    filesPerMinute: 10_000,
    fileSizePerMinute: OneHundredMB, // 10 MB per minute
    premiumInferencesPerMonth: 1_000_000_000_000,
    freeInferencesPerMonth: 1_000_000_000,
    storage: OneGB * 100, // 100 GB
    apiKeys: 100_000, // 100,000 API keys
    abTests: 100_000_000,
  },
  'pro-legacy': {
    monthlyCost: 20,
    providers: 50,
    agents: 10000,
    identities: 10000,
    projects: 100,
    dataSources: 1000,
    templates: 20,
    tools: 300,
    filesPerMinute: 150,
    fileSizePerMinute: TwentyFiveMB, // 10 MB per minute
    groups: 10,
    blocks: 100_000,
    premiumInferencesPerMonth: 500,
    freeInferencesPerMonth: 5_000,
    fileSize: TwentyFiveMB,
    storage: OneGB * 10, // 1 GB
    apiKeys: 1_000, // 100 API keys
    abTests: 1_000,
  },
  scale: {
    monthlyCost: 750,
    providers: 50,
    filesPerMinute: 1500,
    agents: 10_000_000,
    identities: 10_000_000,
    projects: 100,
    dataSources: 1000,
    templates: 100,
    tools: 300,
    groups: 10,
    fileSizePerMinute: OneHundredMB, // 100 MB per minute
    blocks: 100_000_0000,
    premiumInferencesPerMonth: 5_000,
    freeInferencesPerMonth: 50_000,
    fileSize: TwentyFiveMB,
    storage: OneGB * 100, // 1 GB
    apiKeys: 5_000, // 5,000 API keys
    abTests: 10_000,
  },
  pro: {
    monthlyCost: 20,
    providers: 5,
    agents: 10_000_000,
    identities: 10_000_000,
    projects: 100,
    dataSources: 10_000_000,
    templates: 20,
    tools: 300,
    filesPerMinute: 150,
    fileSizePerMinute: TwentyFiveMB, // 10 MB per minute
    groups: 10,
    blocks: 100_000_000,
    premiumInferencesPerMonth: 0,
    freeInferencesPerMonth: 0,
    fileSize: TwentyFiveMB,
    storage: OneGB * 10, // 1 GB
    apiKeys: 1_000, // 100 API keys
    abTests: 1_000,
  },
  free: {
    monthlyCost: 0,
    providers: 5,
    agents: 100,
    identities: 100,
    dataSources: 25,
    filesPerMinute: 10,
    projects: 25,
    templates: 10,
    blocks: 5_000,
    tools: 300,
    groups: 1,
    fileSizePerMinute: FiveMB, // 1 MB per minute
    premiumInferencesPerMonth: 50,
    freeInferencesPerMonth: 500,
    fileSize: FiveMB, // 5 MB
    storage: OneGB, // 1 GB
    apiKeys: 25,
    abTests: 10,
  },
};

export function getRecurrentSubscriptionLimits(subscription: Partial<PaymentCustomerSubscription>) {
  const { tier } = subscription;

  switch (tier) {
    case 'free':
      return 5_000;
    case 'pro':
      return 20_000;
    default:
      return 0;
  }
}

export function getUsageLimits(billingTier: BillingTiersType) {
  return limitMap[billingTier] || limitMap.free;
}

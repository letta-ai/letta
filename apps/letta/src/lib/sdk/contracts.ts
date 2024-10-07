import { agentsContract, agentsQueryKeys } from './agents/agentsContract';
import { healthContract } from '$letta/sdk/health/healthContract';

export const sdkContracts = {
  agents: agentsContract,
  health: healthContract,
};

export const sdkQueryKeys = {
  agents: agentsQueryKeys,
};

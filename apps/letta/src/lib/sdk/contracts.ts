import { agentsContract, agentsQueryKeys } from './agents/agentsContract';
import { healthContract } from '$letta/sdk/health/healthContract';
import {
  modelContracts,
  modelQueryClientKeys,
} from '$letta/sdk/models/modelsContracts';

export const sdkContracts = {
  agents: agentsContract,
  models: modelContracts,
  health: healthContract,
};

export const sdkQueryKeys = {
  agents: agentsQueryKeys,
  models: modelQueryClientKeys,
};

import { agentsContract, agentsQueryKeys } from './agents/agentsContract';
import { healthContract } from '$web/sdk/health/healthContract';
import {
  modelContracts,
  modelQueryClientKeys,
} from '$web/sdk/models/modelsContracts';

export const sdkContracts = {
  agents: agentsContract,
  models: modelContracts,
  health: healthContract,
};

export const sdkQueryKeys = {
  agents: agentsQueryKeys,
  models: modelQueryClientKeys,
};

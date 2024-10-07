import { agentsRouter } from './agents/agentsRouter';
import { healthRouter } from '$letta/sdk/health/healthRouter';

export const sdkRouter = {
  agents: agentsRouter,
  health: healthRouter,
};

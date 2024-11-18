import { agentsRouter } from './agents/agentsRouter';
import { healthRouter } from '$letta/sdk/health/healthRouter';
import { modelsRouter } from '$letta/sdk/models/modelRoutes';

export const sdkRouter = {
  agents: agentsRouter,
  health: healthRouter,
  models: modelsRouter,
};

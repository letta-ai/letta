import { agentsRouter } from './agents/agentsRouter';
import { healthRouter } from '$web/sdk/health/healthRouter';
import { modelsRouter } from '$web/sdk/models/modelRoutes';

export const sdkRouter = {
  agents: agentsRouter,
  health: healthRouter,
  models: modelsRouter,
};

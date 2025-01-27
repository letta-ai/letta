import { agentsRouter } from './agents/agentsRouter';
import { healthRouter } from '$web/sdk/health/healthRouter';
import { modelsRouter } from '$web/sdk/models/modelRoutes';
import { templatesRouter } from '$web/sdk/templates/templatesRouter';

export const sdkRouter = {
  agents: agentsRouter,
  health: healthRouter,
  models: modelsRouter,
  templates: templatesRouter,
};

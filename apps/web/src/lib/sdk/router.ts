import { agentsRouter } from './agents/agentsRouter';
import { healthRouter } from './health/healthRouter';
import { modelsRouter } from './models/modelRoutes';
import { templatesRouter } from './templates/templatesRouter';

export const sdkRouter = {
  agents: agentsRouter,
  health: healthRouter,
  models: modelsRouter,
  templates: templatesRouter,
};

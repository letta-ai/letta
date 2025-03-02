import { agentsRouter } from './agents/agentsRouter';
import { healthRouter } from './health/healthRouter';
import { templatesRouter } from './templates/templatesRouter';

export const sdkRouter = {
  agents: agentsRouter,
  health: healthRouter,
  templates: templatesRouter,
};

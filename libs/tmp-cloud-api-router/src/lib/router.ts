import { agentsRouter } from './agents/agentsRouter';
import { templatesRouter } from './templates/templatesRouter';

export const cloudApiRouter = {
  agents: agentsRouter,
  templates: templatesRouter,
};

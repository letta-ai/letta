import { agentsRouter } from './agents/agentsRouter';
import { templatesRouter } from './templates/templatesRouter';

export const sdkRouter = {
  agents: agentsRouter,
  templates: templatesRouter,
};

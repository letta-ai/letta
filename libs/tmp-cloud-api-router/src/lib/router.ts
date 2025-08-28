import { agentsRouter } from './agents/agentsRouter';
import { templatesRouter } from './templates/templatesRouter';
import { clientSideAccessTokensRouter } from './clientSideAccessTokens/clientSideAccessTokensRouter';
import { projectsRouter } from './projectsRouter/projectsRouter';
import { modelsRouter } from './models/modelsRouter';

export const cloudApiRouter = {
  agents: agentsRouter,
  models: modelsRouter,
  templates: templatesRouter,
  clientSideAccessTokens: clientSideAccessTokensRouter,
  projects: projectsRouter,
};

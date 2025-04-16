import { agentsRouter } from './agents/agentsRouter';
import { templatesRouter } from './templates/templatesRouter';
import { clientSideAccessTokensRouter } from './clientSideAccessTokens/clientSideAccessTokensRouter';
import { projectsRouter } from './projectsRouter/projectsRouter';

export const cloudApiRouter = {
  agents: agentsRouter,
  templates: templatesRouter,
  clientSideAccessTokens: clientSideAccessTokensRouter,
  projects: projectsRouter,
};

import { agentsRouter } from './agents/agentsRouter';
import { templatesRouter } from './templates/templatesRouter';
import { clientSideAccessTokensRouter } from './clientSideAccessTokens/clientSideAccessTokensRouter';

export const cloudApiRouter = {
  agents: agentsRouter,
  templates: templatesRouter,
  clientSideAccessTokens: clientSideAccessTokensRouter,
};

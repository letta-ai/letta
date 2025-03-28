import { CurrentAgentTools } from './routes/CurrentAgentTools/CurrentAgentTools';
import type { NavigationKeys } from './hooks/useToolManagerRouteCopy/useToolManagerRouteCopy';
import { MyTools } from './routes/MyTools/MyTools';
import { LettaTools } from './routes/LettaTools/LettaTools';
import { ComposioToolsRoot } from './routes/ComposioToolsRoot/ComposioToolsRoot';
import { ComposioSpecificAppTools } from './routes/ComposioSpecificAppTools/ComposioSpecificAppTools';
import { MCPServers } from './routes/MCPServers/MCPServers';
import { ToolRulesEditor } from '../ToolRules/ToolRules';

interface Routes {
  path: string;
  key: NavigationKeys;
  component: React.ReactNode;
}

export const toolManagerRoutes = [
  {
    path: '/current-agent-tools',
    key: 'current',
    component: <CurrentAgentTools />,
  },
  {
    path: '/tool-rules',
    key: 'toolRules',
    component: <ToolRulesEditor />,
  },
  {
    path: '/composio/:appKey',
    key: 'composioTool',
    component: <ComposioSpecificAppTools />,
  },
  {
    path: '/composio',
    key: 'composioTools',
    component: <ComposioToolsRoot />,
  },

  {
    path: '/mcp-servers',
    key: 'mcpServers',
    component: <MCPServers />,
  },
  {
    path: '/my-tools',
    key: 'customTools',
    component: <MyTools />,
  },
  {
    path: '/letta-tools',
    key: 'lettaTools',
    component: <LettaTools />,
  },
] satisfies Routes[];

export type ToolManagerPaths<Key extends number = number> =
  (typeof toolManagerRoutes)[Key]['path'];

export function isValidToolManagerRoute(path: string): boolean {
  // account for :variable paths
  const pathParts = path.split('/').filter(Boolean);

  if (pathParts.length === 0) {
    return false;
  }

  return toolManagerRoutes.some((route) => {
    const routeParts = route.path.split('/').filter(Boolean);

    if (routeParts.length !== pathParts.length) {
      return false;
    }

    return routeParts.every((part, index) => {
      return part.startsWith(':') || part === pathParts[index];
    });
  });
}

export function getMatchingRoute(path: string): Routes | undefined {
  return toolManagerRoutes.find((route) => {
    const routeParts = route.path.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (routeParts.length !== pathParts.length) {
      return false;
    }

    return routeParts.every((part, index) => {
      return part.startsWith(':') || part === pathParts[index];
    });
  });
}

export function getRouteFromKey(key: NavigationKeys): Routes | undefined {
  return toolManagerRoutes.find((route) => route.key === key);
}

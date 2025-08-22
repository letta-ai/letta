import { CurrentAgentTools } from './routes/CurrentAgentTools/CurrentAgentTools';
import type { NavigationKeys } from './hooks/useToolManagerRouteCopy/useToolManagerRouteCopy';
import { MyTools } from './routes/MyTools/MyTools';
import { LettaTools } from './routes/LettaTools/LettaTools';
import { MCPServers } from './routes/MCPServers/MCPServers';
import { ToolRulesEditor } from '../ToolRules/ToolRules';
import { ToolVariables } from './routes/ToolVariables/ToolVariables';
import { MCPServerExplorer } from './routes/MCPServerExplorer/MCPServerExplorer';
import { ToolManagerPage } from './components/ToolManagerPage/ToolManagerPage';

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
    path: '/mcp-servers',
    key: 'mcpServers',
    component: (
      <ToolManagerPage border>
        <MCPServers />
      </ToolManagerPage>
    ),
  },
  {
    path: '/my-tools',
    key: 'customTools',
    component: <MyTools />,
  },
  {
    path: '/tool-variables',
    key: 'toolVariables',
    component: <ToolVariables />,
  },
  {
    path: '/letta-tools',
    key: 'lettaTools',
    component: (
      <LettaTools
        types={['letta_memory_core', 'letta_core', 'letta_sleeptime_core']}
      />
    ),
  },
  {
    path: '/letta-utility-tools',
    key: 'utilityTools',
    component: <LettaTools types={['letta_builtin']} />,
  },
  {
    path: '/mcp-servers/new',
    key: 'addMCPServers',
    component: (
      <ToolManagerPage>
        <MCPServerExplorer />
      </ToolManagerPage>
    ),
  },
  {
    path: '/letta-multiagent-tools',
    key: 'multiAgentTools',
    component: <LettaTools types={['letta_multi_agent_core']} />,
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

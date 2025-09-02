import { useTranslations } from '@letta-cloud/translations';
import {
  CustomToolIcon,
  LettaToolIcon,
  McpIcon,
  PackageIcon,
  RuleIcon,
  ToolsIcon,
  VariableIcon,
} from '@letta-cloud/ui-component-library';
import {
  useToolsServiceCountTools,
  useToolsServiceListMcpServers,
} from '@letta-cloud/sdk-core';
import { useMemo } from 'react';

export function useToolManagerRouteCopy() {
  const t = useTranslations('ToolManager');

  const { data: multiAgentToolCount } = useToolsServiceCountTools({ toolTypes: ['letta_multi_agent_core'] });
  const { data: utilityToolCount } = useToolsServiceCountTools({ toolTypes: ['letta_builtin'] });
  const { data: lettaToolCount } = useToolsServiceCountTools({ toolTypes: ['letta_memory_core', 'letta_core', 'letta_sleeptime_core'] });
  const { data: toolCount } = useToolsServiceCountTools({ toolTypes: ['custom'] })
  const { data: servers } = useToolsServiceListMcpServers();


  const serverCount = useMemo(() => {
    return servers ? Object.keys(servers).length : 0;
  }, [servers]);

  return useMemo(
    () => ({
      current: {
        title: t('ToolManagerNavigationSidebar.current'),
        icon: <ToolsIcon />,
      },
      customTools: {
        title: t.rich('ToolManagerNavigationSidebar.customTools', {
          count: () => (toolCount ? `(${toolCount})` : ''),
        }),
        icon: <CustomToolIcon />,
      },

      toolVariables: {
        title: t('ToolManagerNavigationSidebar.toolVariables'),
        icon: <VariableIcon />,
      },
      dependencies: {
        title: t('ToolManagerNavigationSidebar.dependencies'),
        icon: <PackageIcon />,
      },
      toolRules: {
        title: t('ToolManagerNavigationSidebar.toolRules'),
        icon: <RuleIcon />,
      },
      lettaTools: {
        title: t.rich('ToolManagerNavigationSidebar.lettaTools', {
          count: () => (toolCount ? `(${lettaToolCount})` : ''),
        }),
        icon: <LettaToolIcon />,
      },
      mcpServers: {
        title: t.rich('ToolManagerNavigationSidebar.mcpServers', {
          count: () => (serverCount ? `(${serverCount})` : ''),
        }),
        icon: <McpIcon />,
      },
      recommendedServers: {
        title: t('ToolManagerNavigationSidebar.recommendedServers'),
        icon: <McpIcon />,
      },
      utilityTools: {
        title: t.rich('ToolManagerNavigationSidebar.utilityTools', {
          count: () => (utilityToolCount ? `(${utilityToolCount})` : ''),
        }),
        icon: <LettaToolIcon />,
      },
      multiAgentTools: {
        title: t.rich('ToolManagerNavigationSidebar.multiAgentTools', {
          count: () => (toolCount ? `(${multiAgentToolCount})` : ''),
        }),
        icon: <LettaToolIcon />,
      },
      addMCPServers: {
        title: t('ToolManagerNavigationSidebar.createServer'),
        icon: <McpIcon />,
      },
    }),
    [
      lettaToolCount,
      multiAgentToolCount,
      serverCount,
      t,
      toolCount,
      utilityToolCount,
    ],
  );
}

export type NavigationKeys = keyof ReturnType<typeof useToolManagerRouteCopy>;

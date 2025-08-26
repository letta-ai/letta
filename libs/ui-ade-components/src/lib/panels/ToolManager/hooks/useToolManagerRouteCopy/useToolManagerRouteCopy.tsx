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
  useToolsServiceListMcpServers,
  useToolsServiceListTools,
} from '@letta-cloud/sdk-core';
import { useMemo } from 'react';
import { LIST_TOOLS_LIMIT } from '@letta-cloud/ui-ade-components';

export function useToolManagerRouteCopy() {
  const t = useTranslations('ToolManager');

  const { data: tools } = useToolsServiceListTools({ limit: LIST_TOOLS_LIMIT });

  const counts = useMemo(() => {
    if (!tools) {
      return {} as Record<string, number>;
    }

    return tools.reduce(
      (acc, tool) => {
        if (tool.tool_type) {
          acc[tool.tool_type] = (acc[tool.tool_type] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [tools]);

  const utilityToolCount = useMemo(() => {
    if (!tools) {
      return 0;
    }
    return counts['letta_builtin'] || 0;
  }, [counts, tools]);

  const multiAgentToolCount = useMemo(() => {
    if (!tools) {
      return 0;
    }
    return counts['letta_multi_agent_core'] || 0;
  }, [counts, tools]);

  const lettaToolCount = useMemo(() => {
    if (!tools) {
      return 0;
    }

    return (
      counts['letta_memory_core'] +
        counts['letta_core'] +
        counts['letta_sleeptime_core'] || 0
    );
  }, [counts, tools]);

  const { data: servers } = useToolsServiceListMcpServers();

  const toolCount = useMemo(() => {
    if (!tools) {
      return 0;
    }

    return counts['custom'];
  }, [counts, tools]);
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

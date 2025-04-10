import { useTranslations } from '@letta-cloud/translations';
import {
  ComposioLogoMarkDynamic,
  CustomToolIcon,
  LettaToolIcon,
  McpIcon,
  RuleIcon,
  ToolsIcon,
  VariableIcon,
} from '@letta-cloud/ui-component-library';

export function useToolManagerRouteCopy() {
  const t = useTranslations('ToolManager');

  return {
    current: {
      title: t('ToolManagerNavigationSidebar.current'),
      icon: <ToolsIcon />,
    },
    customTools: {
      title: t('ToolManagerNavigationSidebar.customTools'),
      icon: <CustomToolIcon />,
    },

    toolVariables: {
      title: t('ToolManagerNavigationSidebar.toolVariables'),
      icon: <VariableIcon />,
    },
    toolRules: {
      title: t('ToolManagerNavigationSidebar.toolRules'),
      icon: <RuleIcon />,
    },
    lettaTools: {
      title: t('ToolManagerNavigationSidebar.lettaTools'),
      icon: <LettaToolIcon />,
    },
    composioTool: {
      title: '',
      icon: <ComposioLogoMarkDynamic />,
    },
    composioTools: {
      title: t('ToolManagerNavigationSidebar.composioTools'),
      icon: <ComposioLogoMarkDynamic />,
    },
    mcpServers: {
      title: t('ToolManagerNavigationSidebar.mcpServers'),
      icon: <McpIcon />,
    },
  };
}

export type NavigationKeys = keyof ReturnType<typeof useToolManagerRouteCopy>;

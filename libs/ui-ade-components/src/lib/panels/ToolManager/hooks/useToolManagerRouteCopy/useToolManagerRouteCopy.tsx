import { useTranslations } from '@letta-cloud/translations';
import {
  ComposioLogoMarkDynamic,
  LettaInvaderIcon,
  LettaLogoIcon,
  McpIcon,
  RuleIcon,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';

export function useToolManagerRouteCopy() {
  const t = useTranslations('ToolManager');

  return {
    current: {
      title: t('ToolManagerNavigationSidebar.current'),
      icon: <LettaInvaderIcon />,
    },
    customTools: {
      title: t('ToolManagerNavigationSidebar.customTools'),
      icon: <ToolsIcon />,
    },
    toolRules: {
      title: t('ToolManagerNavigationSidebar.toolRules'),
      icon: <RuleIcon />,
    },
    lettaTools: {
      title: t('ToolManagerNavigationSidebar.lettaTools'),
      icon: <LettaLogoIcon />,
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

import { useTranslations } from '@letta-cloud/translations';
import {
  ComposioLogoMarkDynamic,
  DatabaseIcon,
  LettaInvaderIcon,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';
import type { ToolViewerCategory } from '../useAllToolsViewState/useAllToolsViewState';
import React from 'react';

export function useToolCategoryDetails() {
  const t = useTranslations('AllToolsView');

  return {
    current: {
      title: t('ToolCategorySidebar.current'),
      icon: <LettaInvaderIcon />,
    },
    local: {
      title: t('ToolCategorySidebar.local'),
      icon: <ToolsIcon />,
    },
    mcp: {
      title: t('ToolCategorySidebar.mcp'),
      icon: <DatabaseIcon />,
    },
    composio: {
      title: t('ToolCategorySidebar.composio'),
      icon: <ComposioLogoMarkDynamic />,
    },
  } satisfies Record<
    ToolViewerCategory,
    { title: string; icon: React.ReactNode }
  >;
}

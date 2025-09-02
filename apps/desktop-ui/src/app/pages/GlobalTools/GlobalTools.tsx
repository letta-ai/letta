import {
  LoadingEmptyStatusComponent,
  DesktopPageLayout,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';
import { useToolsServiceListTools, useToolsServiceCountTools } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { ToolsEditor } from '@letta-cloud/ui-ade-components';
import { useMemo, useState } from 'react';
import { DesktopToolManagerLayout } from './ToolManagerLayout';

export function GlobalTools() {
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('custom');

  const t = useTranslations('GlobalTools');

  // Get server-side filtering parameters based on selected category
  const filterParams = useMemo(() => {
    switch (selectedCategory) {
      case 'custom':
        return { toolTypes: ['custom'] };
      case 'multi-agent':
        return { toolTypes: ['letta_multi_agent_core'] };
      case 'utility':
        return { toolTypes: ['letta_builtin'] };
      case 'base':
        return { toolTypes: ['letta_core', 'letta_memory_core', 'letta_sleeptime_core'] };
      case 'mcp-servers':
        return { toolTypes: ['external_mcp'] };
      default:
        return {};
    }
  }, [selectedCategory]);

  // Use server-side filtering for both search and category
  const {
    data: tools,
    isError,
    isLoading,
  } = useToolsServiceListTools({
    search: search || undefined,
    ...filterParams
  });

  // Get counts for each category to display in sidebar
  const { data: customCount } = useToolsServiceCountTools({ toolTypes: ['custom'] });
  const { data: multiAgentCount } = useToolsServiceCountTools({ toolTypes: ['letta_multi_agent_core'] });
  const { data: utilityCount } = useToolsServiceCountTools({ toolTypes: ['letta_builtin'] });
  const { data: baseCount } = useToolsServiceCountTools({ toolTypes: ['letta_core', 'letta_memory_core', 'letta_sleeptime_core'] });
  const { data: mcpCount } = useToolsServiceCountTools({ toolTypes: ['external_mcp'] });

  const categoryCounts = useMemo(() => ({
    custom: customCount ?? 0,
    'multi-agent': multiAgentCount ?? 0,
    utility: utilityCount ?? 0,
    base: baseCount ?? 0,
    'mcp-servers': mcpCount ?? 0,
  }), [customCount, multiAgentCount, utilityCount, baseCount, mcpCount]);

  const allTools = useMemo(() => {
    return tools || [];
  }, [tools]);

  const filteredTools = allTools;

  const [selectedToolId, setSelectedToolId] = useState<string | null>(() => {
    return filteredTools?.[0]?.id || null;
  });

  useMemo(() => {
    if (filteredTools.length > 0 && !filteredTools.find(tool => tool.id === selectedToolId)) {
      setSelectedToolId(filteredTools[0].id || null);
    }
  }, [filteredTools, selectedToolId]);

  if (!tools) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
        isError={isError}
        errorMessage={t('error')}
        loadingMessage={t('loading')}
      />
    );
  }

  return (
    <DesktopPageLayout
      icon={<ToolsIcon />}
      subtitle={t('subtitle')}
      title={t('title')}
    >
      <DesktopToolManagerLayout
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categoryCounts={categoryCounts}
      >
        <ToolsEditor
          selectedToolId={selectedToolId}
          setSelectedToolId={setSelectedToolId}
          allTools={allTools || []}
          filteredTools={filteredTools}
          search={search}
          onSearchChange={setSearch}
        />
      </DesktopToolManagerLayout>
    </DesktopPageLayout>
  );
}

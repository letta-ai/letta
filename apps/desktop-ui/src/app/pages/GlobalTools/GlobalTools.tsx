import {
  LoadingEmptyStatusComponent,
  DesktopPageLayout,
  VStack,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';
import { useToolsServiceListTools } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { ToolsEditor } from '@letta-cloud/ui-ade-components';
import { useMemo, useState } from 'react';
import { DesktopToolManagerLayout } from './ToolManagerLayout';

export function GlobalTools() {
  const {
    data: tools,
    isError,
    isLoading,
  } = useToolsServiceListTools({ limit: 250 });
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('custom');

  const t = useTranslations('GlobalTools');

  const allTools = useMemo(() => {
    return tools || [];
  }, [tools]);

  const filteredTools = useMemo(() => {
    let categoryFilteredTools = allTools;

    switch (selectedCategory) {
      case 'custom':
        categoryFilteredTools = allTools.filter(tool => tool.tool_type === 'custom');
        break;
      case 'multi-agent':
        categoryFilteredTools = allTools.filter(tool => tool.tool_type === 'letta_multi_agent_core');
        break;
      case 'utility':
        categoryFilteredTools = allTools.filter(tool => tool.tool_type === 'letta_builtin');
        break;
      case 'base':
        categoryFilteredTools = allTools.filter(tool =>
          tool.tool_type === 'letta_core' ||
          tool.tool_type === 'letta_memory_core' ||
          tool.tool_type === 'letta_sleeptime_core'
        );
        break;
      case 'mcp-servers':
        categoryFilteredTools = allTools.filter(tool => tool.tool_type === 'external_mcp');
        break;
      default:
        categoryFilteredTools = allTools;
    }

    return categoryFilteredTools.filter((tool) =>
      (tool.name || '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, allTools, selectedCategory]);

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

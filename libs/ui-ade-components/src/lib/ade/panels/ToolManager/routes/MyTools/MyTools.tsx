'use client';
import { ToolsEditor } from '../../components/ToolsEditor/ToolsEditor';
import { useEffect, useMemo, useState } from 'react';
import { useToolsServiceListTools } from '@letta-cloud/sdk-core';
import { LoadingEmptyStatusComponent } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';

export const MY_TOOLS_PAYLOAD = {
  toolTypes: ['custom'  as const],
  limit: 250,
}

export function MyTools() {
  const {
    data: tools,
    isError,
    isLoading,
  } = useToolsServiceListTools(MY_TOOLS_PAYLOAD);
  const [search, setSearch] = useState<string>('');

  const t = useTranslations('ToolsEditor/MyTools');

  const customTools = useMemo(() => {
    return tools?.filter((tool) => tool.tool_type === 'custom') || [];
  }, [tools]);

  const filteredTools = useMemo(() => {
    return (customTools || []).filter((tool) =>
      (tool.name || '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, customTools]);

  const { setSelectedToolId, currentToolId: selectedToolId } =
    useToolManagerState();

  const selectedTool = useMemo(() => {
    return customTools?.find((tool) => tool.id === selectedToolId);
  }, [selectedToolId, customTools]);

  useEffect(() => {
    // if the selected tool no longer exists, select the first tool

    if (
      customTools &&
      customTools.length >= 1 &&
      !selectedTool &&
      customTools?.[0]?.id
    ) {
      setSelectedToolId(customTools[0].id);
    }
  }, [customTools, selectedTool, setSelectedToolId]);

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
    <ToolsEditor
      selectedToolId={selectedToolId}
      setSelectedToolId={setSelectedToolId}
      allTools={customTools || []}
      filteredTools={filteredTools}
      search={search}
      onSearchChange={setSearch}
    />
  );
}

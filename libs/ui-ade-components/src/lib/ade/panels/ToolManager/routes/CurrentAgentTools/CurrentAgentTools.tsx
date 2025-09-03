'use client';
import { useCurrentAgent } from '../../../../../hooks';
import { ToolsEditor } from '../../components/ToolsEditor/ToolsEditor';
import { useMemo, useState } from 'react';
import { LoadingEmptyStatusComponent } from '@letta-cloud/ui-component-library';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';

export function CurrentAgentTools() {
  const { tools } = useCurrentAgent();
  const [search, setSearch] = useState<string>('');

  const filteredTools = useMemo(() => {
    return (tools || []).filter((tool) =>
      (tool.name || '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, tools]);

  const { setSelectedToolId, currentToolId } = useToolManagerState();

  if (!tools) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  return (
    <ToolsEditor
      selectedToolId={currentToolId}
      setSelectedToolId={setSelectedToolId}
      allTools={tools || []}
      filteredTools={filteredTools}
      search={search}
      onSearchChange={setSearch}
    />
  );
}

import { useCurrentAgent } from '../../../../hooks';
import { ToolsEditor } from '../../components/ToolsEditor/ToolsEditor';
import { useEffect, useMemo, useState } from 'react';
import { LoadingEmptyStatusComponent } from '@letta-cloud/ui-component-library';
import { atom, useAtom } from 'jotai';

export const selectedCurrentAgentToolId = atom<string | null>(null);

export function CurrentAgentTools() {
  const { tools } = useCurrentAgent();
  const [search, setSearch] = useState<string>('');

  const filteredTools = useMemo(() => {
    return (tools || []).filter((tool) =>
      (tool.name || '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, tools]);

  const [selectedToolId, setSelectedToolId] = useAtom(
    selectedCurrentAgentToolId,
  );

  const selectedTool = useMemo(() => {
    return tools?.find((tool) => tool.id === selectedToolId);
  }, [selectedToolId, tools]);

  useEffect(() => {
    if (tools && tools.length >= 1 && !selectedTool && tools?.[0]?.id) {
      setSelectedToolId(tools[0].id);
    }
  }, [tools, selectedTool, setSelectedToolId]);

  if (!tools) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  return (
    <ToolsEditor
      selectedToolId={selectedToolId}
      setSelectedToolId={setSelectedToolId}
      allTools={tools || []}
      filteredTools={filteredTools}
      search={search}
      onSearchChange={setSearch}
    />
  );
}

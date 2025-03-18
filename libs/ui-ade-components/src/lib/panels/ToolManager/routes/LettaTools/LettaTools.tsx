import { ToolsEditor } from '../../components/ToolsEditor/ToolsEditor';
import { useMemo, useState } from 'react';
import { useToolsServiceListTools } from '@letta-cloud/sdk-core';
import { LoadingEmptyStatusComponent } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export function LettaTools() {
  const { data: tools, isError, isLoading } = useToolsServiceListTools();
  const [search, setSearch] = useState<string>('');

  const t = useTranslations('ToolsEditor/LettaTools');

  const lettaTools = useMemo(() => {
    return (
      tools?.filter((tool) =>
        ['letta_memory_core', 'letta_multi_agent_core', 'letta_core'].includes(
          tool.tool_type || '',
        ),
      ) || []
    );
  }, [tools]);

  const filteredTools = useMemo(() => {
    return (lettaTools || []).filter((tool) =>
      (tool.name || '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, lettaTools]);

  const [selectedToolId, setSelectedToolId] = useState<string | null>(() => {
    return lettaTools?.[0]?.id || null;
  });

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
      allTools={lettaTools || []}
      filteredTools={filteredTools}
      search={search}
      onSearchChange={setSearch}
    />
  );
}

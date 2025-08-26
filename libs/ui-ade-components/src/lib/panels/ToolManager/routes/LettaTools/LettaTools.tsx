'use client';
import { ToolsEditor } from '../../components/ToolsEditor/ToolsEditor';
import { useMemo, useState } from 'react';
import type { ToolType } from '@letta-cloud/sdk-core';
import { useToolsServiceListTools } from '@letta-cloud/sdk-core';
import { LoadingEmptyStatusComponent } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { LIST_TOOLS_LIMIT } from '@letta-cloud/ui-ade-components';

interface LettaToolsProps {
  types: ToolType[];
}

export function LettaTools(props: LettaToolsProps) {
  const { types } = props;
  const {
    data: tools,
    isError,
    isLoading,
  } = useToolsServiceListTools({ limit: LIST_TOOLS_LIMIT });
  const [search, setSearch] = useState<string>('');

  const t = useTranslations('ToolsEditor/LettaTools');

  const lettaTools = useMemo(() => {
    return (
      tools?.filter(
        (tool) => tool.tool_type && types.includes(tool.tool_type),
      ) || []
    );
  }, [tools, types]);

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

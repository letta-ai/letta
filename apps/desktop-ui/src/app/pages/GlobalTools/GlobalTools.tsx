'use client';
import { ToolsEditor } from '@letta-cloud/ui-ade-components';
import { useMemo, useState } from 'react';
import { useToolsServiceListTools } from '@letta-cloud/sdk-core';
import {
  LoadingEmptyStatusComponent,
  DesktopPageLayout,
  VStack,
  ToolsIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export function GlobalTools() {
  const {
    data: tools,
    isError,
    isLoading,
  } = useToolsServiceListTools({ limit: 250 });
  const [search, setSearch] = useState<string>('');

  const t = useTranslations('GlobalTools');

  const allTools = useMemo(() => {
    return tools || [];
  }, [tools]);

  const filteredTools = useMemo(() => {
    return (allTools || []).filter((tool) =>
      (tool.name || '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, allTools]);

  const [selectedToolId, setSelectedToolId] = useState<string | null>(() => {
    return allTools?.[0]?.id || null;
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
    <DesktopPageLayout
      icon={<ToolsIcon />}
      subtitle={t('subtitle')}
      title={t('title')}
    >
      <VStack fullWidth fullHeight overflowY="auto" padding="small">
        <ToolsEditor
          selectedToolId={selectedToolId}
          setSelectedToolId={setSelectedToolId}
          allTools={allTools || []}
          filteredTools={filteredTools}
          search={search}
          onSearchChange={setSearch}
        />
      </VStack>
    </DesktopPageLayout>
  );
}

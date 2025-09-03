import React, { useMemo } from 'react';
import { LoadingEmptyStatusComponent } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '../../../hooks';
import { NoDatasourceView } from './_components/NoDatasourceView/NoDatasourceView';
import { DataSourceProvider } from './hooks/useDataSourceContext/useDataSourceContext';
import { DataSourceView } from './_components/DataSourceView/DataSourceView';

export function DataSourcesPanel() {
  const { sources } = useCurrentAgent();

  if (!sources) {
    return <LoadingEmptyStatusComponent loaderVariant="grower" hideText isLoading />;
  }

  if (sources.length === 0) {
    return <NoDatasourceView />;
  }

  return (
    <DataSourceProvider>
      <DataSourceView />
    </DataSourceProvider>
  );
}

export function useDataSourcesTitle() {
  const t = useTranslations('ADE/EditDataSourcesPanel');
  const { sources } = useCurrentAgent();

  const count = useMemo(() => {
    if (!sources) {
      return '-';
    }

    return sources.length || 0;
  }, [sources]);

  return t('title', { count });
}

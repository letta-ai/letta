'use client';
import { useParams } from 'next/navigation';
import { useSourcesServiceGetSource } from '@letta-web/letta-agents-api';

export function useCurrentDataSourceId() {
  return useParams<{ dataSourceId: string }>().dataSourceId;
}

export function useCurrentDataSource() {
  const dataSourceId = useCurrentDataSourceId();

  const { data } = useSourcesServiceGetSource({
    sourceId: dataSourceId,
  });

  return data;
}

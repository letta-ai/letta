'use client';
import { useParams } from 'next/navigation';
import { useSourcesServiceRetrieveSource } from '@letta-cloud/sdk-core';

export function useCurrentDataSourceId() {
  return useParams<{ dataSourceId: string }>().dataSourceId;
}

export function useCurrentDataSource() {
  const dataSourceId = useCurrentDataSourceId();

  const { data } = useSourcesServiceRetrieveSource({
    sourceId: dataSourceId,
  });

  return data;
}

'use client';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface UseDatasetsListOptions {
  projectId?: string;
  search?: string;
  offset?: number;
  limit?: number;
  enabled?: boolean;
}

export function useDatasets(options: UseDatasetsListOptions = {}) {
  const { projectId, search, offset = 0, limit = 10, enabled = true } = options;
  const queryClient = useQueryClient();

  const queryParams = useMemo(
    () => ({
      offset,
      limit,
      search: search || undefined,
      projectId,
    }),
    [offset, limit, search, projectId],
  );

  const { data, isLoading, isError, error, refetch } =
    webApi.dataset.getDatasets.useQuery({
      queryKey: webApiQueryKeys.dataset.getDatasetsWithSearch(queryParams),
      queryData: {
        query: queryParams,
      },
      enabled,
    });

  const createDatasetItemMutation =
    webApi.datasetItems.upsertDatasetItem.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.dataset.getDatasetsWithSearch(queryParams),
        });
      },
      onError: (error) => {
        console.error('Failed to upsert dataset item:', error);
      },
    });

  const createDatasetItem = useMemo(
    () => (data: { datasetId: string; content: Record<string, any> }) => {
      const { datasetId, content } = data;
      createDatasetItemMutation.mutate({
        params: { datasetId },
        body: {
          createMessage: {
            data: content,
          },
        },
      });
    },
    [createDatasetItemMutation],
  );

  return {
    datasets: data?.body?.datasets || [],
    hasNextPage: data?.body?.hasNextPage || false,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    createDatasetItem,
    isCreatingDatasetItem: createDatasetItemMutation.isPending,
    createDatasetItemError: createDatasetItemMutation.error as Error | null,
    isCreateDatasetItemError: createDatasetItemMutation.isError,
  };
}

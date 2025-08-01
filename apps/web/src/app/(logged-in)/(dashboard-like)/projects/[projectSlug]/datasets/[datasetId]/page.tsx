'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { webApi, webApiQueryKeys } from '$web/client';
import type { DatasetItemType } from '$web/web-api/contracts';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import {
  DataTable,
  Typography,
  DashboardPageLayout,
  DashboardPageSection,
} from '@letta-cloud/ui-component-library';

export default function DatasetItemsPage() {
  const params = useParams();
  const currentProject = useCurrentProject();
  const { id: projectId, slug: projectSlug } = currentProject;
  const datasetId = params?.datasetId as string;

  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(10);
  const { formatDateAndTime } = useFormatters();
  const t = useTranslations('projects/(projectSlug)/datasets');

  // Fetch dataset items
  const { data: itemsData, isError: isItemsError } =
    webApi.datasetItems.getDatasetItems.useQuery({
      queryKey: webApiQueryKeys.datasetItems.getDatasetItemsWithSearch(
        datasetId || '',
        {
          offset,
          limit,
          search: search || undefined,
        },
      ),
      queryData: {
        params: {
          datasetId: datasetId || '',
        },
        query: {
          offset,
          limit,
          search: search || undefined,
        },
      },
      enabled: !!projectId && !!datasetId,
    });

  // Fetch dataset details
  const { data: datasetData } = webApi.dataset.getDataset.useQuery({
    queryKey: webApiQueryKeys.dataset.getDataset(datasetId || ''),
    queryData: {
      params: {
        datasetId: datasetId || '',
      },
    },
    enabled: !!datasetId,
  });

  const datasetName = datasetData?.body?.name || '';

  const items = itemsData?.body?.datasetItems || [];
  const hasNextPage = itemsData?.body?.hasNextPage || false;

  const columns: Array<ColumnDef<DatasetItemType>> = useMemo(
    () => [
      {
        accessorKey: 'content',
        header: t('datasetItems.table.columns.content'),
        cell: ({ row }) => {
          const content = row.original.createMessage?.data;

          return (
            <Typography variant="body2">{JSON.stringify(content)}</Typography>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: t('datasetItems.table.columns.created'),
        cell: ({ row }) => (
          <Typography variant="body3">
            {formatDateAndTime(new Date(row.original.createdAt))}
          </Typography>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: t('datasetItems.table.columns.updated'),
        cell: ({ row }) => (
          <Typography variant="body3">
            {formatDateAndTime(new Date(row.original.updatedAt))}
          </Typography>
        ),
      },
    ],
    [formatDateAndTime, t],
  );

  return (
    <DashboardPageLayout
      returnButton={{
        text: t('datasetItems.backToDatasets'),
        href: `/projects/${projectSlug}/datasets`,
      }}
      title={datasetName || t('datasetItems.title')}
      subtitle={t('datasetItems.subtitle')}
      encapsulatedFullHeight
    >
      <DashboardPageSection fullHeight>
        <DataTable
          columns={columns}
          data={items}
          isLoading={!itemsData}
          errorMessage={
            isItemsError ? t('datasetItems.table.errorMessage') : undefined
          }
          onSearch={setSearch}
          searchValue={search}
          onSetOffset={setOffset}
          offset={offset}
          limit={limit}
          hasNextPage={hasNextPage}
          showPagination
          autofitHeight
          onLimitChange={setLimit}
          loadingText={t('datasetItems.table.loading')}
          noResultsText={t('datasetItems.table.noResults')}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

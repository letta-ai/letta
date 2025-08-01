'use client';

import React, { useState, useMemo } from 'react';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { webApi, webApiQueryKeys } from '$web/client';
import type { DatasetType } from '$web/web-api/contracts';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import {
  DataTable,
  Button,
  Typography,
  Dialog,
  FormField,
  FormProvider,
  Input,
  TextArea,
  DashboardPageLayout,
  DashboardPageSection,
  PlusIcon,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';

const createDatasetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type CreateDatasetFormValues = z.infer<typeof createDatasetSchema>;

interface CreateDatasetDialogProps {
  projectId: string;
}

function CreateDatasetDialog({ projectId }: CreateDatasetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const t = useTranslations('projects/(projectSlug)/datasets');

  const form = useForm<CreateDatasetFormValues>({
    resolver: zodResolver(createDatasetSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const { mutate, isPending } = webApi.dataset.createDataset.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.dataset.getDatasetsWithSearch({ projectId }),
      });
      setIsOpen(false);
      form.reset();
    },
  });

  function onSubmit(values: CreateDatasetFormValues) {
    mutate({
      body: {
        ...values,
        projectId,
      },
    });
  }

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t('createDataset.title')}
        trigger={
          <Button label={t('createDataset.trigger')} preIcon={<PlusIcon />} />
        }
        onSubmit={form.handleSubmit(onSubmit)}
        confirmText={
          isPending
            ? t('createDataset.confirmTextLoading')
            : t('createDataset.confirmText')
        }
        disableSubmit={isPending}
        cancelText={t('createDataset.cancelText')}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              label={t('createDataset.name.label')}
              placeholder={t('createDataset.name.placeholder')}
              fullWidth
              {...field}
            />
          )}
        />
        <FormField
          name="description"
          render={({ field }) => (
            <TextArea
              label={t('createDataset.description.label')}
              placeholder={t('createDataset.description.placeholder')}
              fullWidth
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

export default function DatasetsPage() {
  const currentProject = useCurrentProject();
  const { id: projectId, slug: projectSlug } = currentProject;
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(10);
  const router = useRouter();
  const { formatDateAndTime } = useFormatters();
  const t = useTranslations('projects/(projectSlug)/datasets');

  const { data, isFetching, isError } = webApi.dataset.getDatasets.useQuery({
    queryKey: webApiQueryKeys.dataset.getDatasetsWithSearch({
      offset,
      limit,
      search: search || undefined,
      projectId,
    }),
    queryData: {
      query: {
        offset,
        limit,
        search: search || undefined,
        projectId,
      },
    },
    enabled: !!projectId, // Only run query if we have a project ID
  });

  const datasets = data?.body?.datasets || [];
  const hasNextPage = data?.body?.hasNextPage || false;

  const columns: Array<ColumnDef<DatasetType>> = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: t('table.columns.name'),
        cell: ({ row }) => (
          <Typography variant="body2">{row.original.name}</Typography>
        ),
      },
      {
        accessorKey: 'description',
        header: t('table.columns.description'),
        cell: ({ row }) => (
          <Typography variant="body3">
            {row.original.description || '—'}
          </Typography>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('table.columns.created'),
        cell: ({ row }) => (
          <Typography variant="body3">
            {formatDateAndTime(new Date(row.original.createdAt))}
          </Typography>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: t('table.columns.updated'),
        cell: ({ row }) => (
          <Typography variant="body3">
            {formatDateAndTime(new Date(row.original.updatedAt))}
          </Typography>
        ),
      },
    ],
    [formatDateAndTime, t],
  );

  function handleRowClick(dataset: DatasetType) {
    router.push(`/projects/${projectSlug}/datasets/${dataset.id}`);
  }

  return (
    <DashboardPageLayout
      title={t('title')}
      encapsulatedFullHeight
      subtitle={t('subtitle')}
      actions={<CreateDatasetDialog projectId={projectId} />}
    >
      <DashboardPageSection fullHeight>
        <DataTable
          columns={columns}
          data={datasets}
          isLoading={isFetching}
          errorMessage={isError ? t('table.errorMessage') : undefined}
          onRowClick={handleRowClick}
          onSearch={setSearch}
          searchValue={search}
          onSetOffset={setOffset}
          offset={offset}
          limit={limit}
          hasNextPage={hasNextPage}
          showPagination
          autofitHeight
          onLimitChange={setLimit}
          loadingText={t('table.loading')}
          noResultsText={t('table.noResults')}
          noResultsAction={<CreateDatasetDialog projectId={projectId} />}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

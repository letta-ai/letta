'use client';
import React, { useCallback } from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DashboardStatusComponent,
  DataTable,
  Dialog,
  FormField,
  FormProvider,
  Input,
  PlusIcon,
  TextArea,
  useForm,
} from '@letta-web/component-library';
import type { ColumnDef } from '@tanstack/react-table';
import type { Source } from '@letta-web/letta-agents-api';
import {
  useSourcesServiceCreateSource,
  UseSourcesServiceListSourcesKeyFn,
} from '@letta-web/letta-agents-api';
import { useSourcesServiceListSources } from '@letta-web/letta-agents-api';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

const createDataSourceSchema = z.object({
  name: z.string(),
  description: z.string(),
});

type CreateDataSourceSchemaType = z.infer<typeof createDataSourceSchema>;

function CreateDataSourceDialog() {
  const { push } = useRouter();

  const queryClient = useQueryClient();
  const { mutate, isPending } = useSourcesServiceCreateSource({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({
        queryKey: UseSourcesServiceListSourcesKeyFn(),
      });

      push(`/data-sources/${response.id}`);
    },
  });

  const form = useForm<CreateDataSourceSchemaType>({
    resolver: zodResolver(createDataSourceSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleSubmit = useCallback(
    (values: CreateDataSourceSchemaType) => {
      mutate({
        requestBody: {
          name: values.name,
          description: values.description,
        },
      });
    },
    [mutate]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title="Create Data Source"
        confirmText="Create"
        cancelText="Cancel"
        isConfirmBusy={isPending}
        trigger={<Button preIcon={<PlusIcon />} label="Create Data Source" />}
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="name"
          render={({ field }) => <Input fullWidth label="Name" {...field} />}
        />
        <FormField
          name="description"
          render={({ field }) => (
            <TextArea fullWidth label="Description" {...field} />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

const dataSourceColumn: Array<ColumnDef<Source>> = [
  {
    header: 'Name',
    accessorKey: 'name',
  },
  {
    header: 'Description',
    accessorKey: 'description',
  },
  {
    header: 'Created At',
    accessorKey: 'created_at',
  },
  {
    header: '',
    id: 'actions',
    meta: {
      style: {
        columnAlign: 'right',
      },
    },
    accessorKey: 'id',
    cell: ({ cell }) => (
      <Button
        color="tertiary"
        label="View"
        href={`/data-sources/${cell.row.original.id}`}
      />
    ),
  },
];

function DataSourcesTable() {
  const { data, isLoading, isError } = useSourcesServiceListSources();

  if (!data || data.length === 0) {
    return (
      <DashboardStatusComponent
        emptyMessage="No Data Sources found"
        isLoading={!isLoading}
        loadingMessage="Loading Data Sources"
        isError={isError}
      />
    );
  }

  return <DataTable columns={dataSourceColumn} data={data} />;
}

function DataSourcesPage() {
  return (
    <DashboardPageLayout
      title="Data Sources"
      actions={
        <>
          <CreateDataSourceDialog />
        </>
      }
    >
      <DashboardPageSection>
        <DataSourcesTable />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DataSourcesPage;

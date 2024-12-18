'use client';
import React, { useCallback, useMemo } from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  LoadingEmptyStatusComponent,
  DataTable,
  Dialog,
  FormField,
  FormProvider,
  Input,
  PlusIcon,
  TextArea,
  useForm,
  Select,
  isBrandKey,
  brandKeyToLogo,
  brandKeyToName,
  isMultiValue,
  OptionTypeSchemaSingle,
} from '@letta-web/component-library';
import type { ColumnDef } from '@tanstack/react-table';
import type { Source } from '@letta-web/letta-agents-api';
import { useModelsServiceListEmbeddingModels } from '@letta-web/letta-agents-api';
import {
  useSourcesServiceCreateSource,
  UseSourcesServiceListSourcesKeyFn,
} from '@letta-web/letta-agents-api';
import { useSourcesServiceListSources } from '@letta-web/letta-agents-api';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const createDataSourceSchema = z.object({
  name: z.string().min(3),
  description: z.string(),
  embedding_config_model: OptionTypeSchemaSingle,
});

type CreateDataSourceSchemaType = z.infer<typeof createDataSourceSchema>;

function CreateDataSourceDialog() {
  const { push } = useRouter();
  const t = useTranslations('data-sources/page');

  const queryClient = useQueryClient();
  const { mutate, isPending } = useSourcesServiceCreateSource({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({
        queryKey: UseSourcesServiceListSourcesKeyFn(),
      });

      push(`/data-sources/${response.id}`);
    },
  });

  const { data: embeddingModels, isLoading } =
    useModelsServiceListEmbeddingModels();

  const formattedModelsList = useMemo(() => {
    if (!embeddingModels) {
      return [];
    }

    const modelEndpointMap = embeddingModels.reduce((acc, model) => {
      acc[model.embedding_endpoint_type] =
        acc[model.embedding_endpoint_type] || [];

      acc[model.embedding_endpoint_type].push(model.embedding_model);

      return acc;
    }, {} as Record<string, string[]>);

    return Object.entries(modelEndpointMap).map(([key, value]) => ({
      icon: isBrandKey(key) ? brandKeyToLogo(key) : '',
      label: isBrandKey(key) ? brandKeyToName(key) : key,
      options: value.map((model) => ({
        icon: isBrandKey(key) ? brandKeyToLogo(key) : '',
        label: model,
        value: model,
      })),
    }));
  }, [embeddingModels]);

  const form = useForm<CreateDataSourceSchemaType>({
    resolver: zodResolver(createDataSourceSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleSubmit = useCallback(
    (values: CreateDataSourceSchemaType) => {
      const embeddingModel = embeddingModels?.find(
        (model) => model.embedding_model === values.embedding_config_model.value
      );

      if (!embeddingModel) {
        return;
      }

      mutate({
        requestBody: {
          name: values.name,
          description: values.description,
          embedding_config: embeddingModel,
        },
      });
    },
    [embeddingModels, mutate]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title={t('CreateDataSourceDialog.title')}
        confirmText={t('CreateDataSourceDialog.createButton')}
        isConfirmBusy={isPending}
        trigger={
          <Button
            preIcon={<PlusIcon />}
            label={t('CreateDataSourceDialog.trigger')}
          />
        }
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('CreateDataSourceDialog.name.label')}
              {...field}
            />
          )}
        />
        <FormField
          name="embedding_config_model"
          render={({ field }) => (
            <Select
              fullWidth
              hideIconsOnOptions
              isLoading={isLoading}
              onSelect={(value) => {
                if (isMultiValue(value)) {
                  return;
                }

                field.onChange(value);
              }}
              value={field.value}
              label={t('CreateDataSourceDialog.embeddingModel.label')}
              options={formattedModelsList}
            />
          )}
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
  const { data, isError } = useSourcesServiceListSources();

  if (!data || data.length === 0) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage="No data sources found"
        isLoading={!data}
        loadingMessage="Loading data sources"
        isError={isError}
      />
    );
  }

  return <DataTable columns={dataSourceColumn} data={data} />;
}

function DataSourcesPage() {
  return (
    <DashboardPageLayout
      title="Data sources"
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

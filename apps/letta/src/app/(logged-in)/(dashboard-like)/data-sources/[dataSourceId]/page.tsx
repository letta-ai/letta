'use client';
import React, { useCallback } from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  FormField,
  FormProvider,
  SingleFileUpload,
  useForm,
} from '@letta-web/component-library';
import type { Document } from '@letta-web/letta-agents-api';
import { UseSourcesServiceListSourceDocumentsKeyFn } from '@letta-web/letta-agents-api';
import { useSourcesServiceUploadFileToSource } from '@letta-web/letta-agents-api';
import { useSourcesServiceListSourceDocuments } from '@letta-web/letta-agents-api';
import { useCurrentDataSourceId } from './hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { get } from 'lodash-es';
import { FileUpIcon } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';

const uploadToFormValuesSchema = z.object({
  file: z.custom<File>((v) => v instanceof File),
});

type UploadToFormValues = z.infer<typeof uploadToFormValuesSchema>;

function UploadFileDialog() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const { mutate, isPending } = useSourcesServiceUploadFileToSource({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: UseSourcesServiceListSourceDocumentsKeyFn({
          sourceId: dataSourceId,
        }),
      });

      setIsDialogOpen(false);
    },
  });
  const dataSourceId = useCurrentDataSourceId();

  const form = useForm<UploadToFormValues>({
    resolver: zodResolver(uploadToFormValuesSchema),
    mode: 'onChange',
  });

  const onSubmit = useCallback(
    (values: UploadToFormValues) => {
      console.log(values.file);
      mutate({
        formData: { file: values.file },
        sourceId: dataSourceId,
      });
    },
    [dataSourceId, mutate]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={setIsDialogOpen}
        isOpen={isDialogOpen}
        onSubmit={form.handleSubmit(onSubmit)}
        title="Upload File"
        confirmText="Upload"
        isConfirmBusy={isPending}
        trigger={<Button label="Upload File" preIcon={<FileUpIcon />} />}
      >
        <FormField
          render={({ field }) => (
            <SingleFileUpload fullWidth {...field} hideLabel label="file" />
          )}
          name="file"
        />
      </Dialog>
    </FormProvider>
  );
}

const dataSourceColumns: Array<ColumnDef<Document>> = [
  {
    header: 'File Name',
    accessorFn: (row) => get(row.metadata_, 'filename', ''),
  },
  {
    header: 'Size',
    accessorFn: (row) => row.text.length,
  },
  {
    header: '',
    id: 'actions',
    accessorKey: 'id',
  },
];

function DataSourceList() {
  const dataSourceId = useCurrentDataSourceId();
  const { data } = useSourcesServiceListSourceDocuments({
    sourceId: dataSourceId,
  });

  return (
    <DataTable
      columns={dataSourceColumns}
      data={data || []}
      isLoading={!data}
      noResultsText="There are no files in this datasource"
    />
  );
}

function DataSourceHomePage() {
  return (
    <DashboardPageLayout title="Files" actions={<UploadFileDialog />}>
      <DashboardPageSection>
        <DataSourceList />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DataSourceHomePage;

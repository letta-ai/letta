'use client';
import React, { Fragment, useCallback, useEffect, useMemo } from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  IndeterminateProgress,
  SingleFileUpload,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import type { Job } from '@letta-web/letta-agents-api';
import {
  useJobsServiceListActiveJobs,
  UseJobsServiceListActiveJobsKeyFn,
  useSourcesServiceGetSource,
} from '@letta-web/letta-agents-api';
import { UseSourcesServiceListFilesFromSourceKeyFn } from '@letta-web/letta-agents-api';
import { useSourcesServiceUploadFileToSource } from '@letta-web/letta-agents-api';
import { useCurrentDataSourceId } from './hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { FileUpIcon } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '$letta/client/hooks';

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
        queryKey: UseSourcesServiceListFilesFromSourceKeyFn({
          sourceId: dataSourceId,
        }),
      });

      void queryClient.invalidateQueries({
        queryKey: UseJobsServiceListActiveJobsKeyFn(),
      });

      setIsDialogOpen(false);
    },
  });
  const dataSourceId = useCurrentDataSourceId();

  const form = useForm<UploadToFormValues>({
    resolver: zodResolver(uploadToFormValuesSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);

  const onSubmit = useCallback(
    (values: UploadToFormValues) => {
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

// const dataSourceColumns: Array<ColumnDef<Document>> = [
//   {
//     header: 'File Name',
//     accessorFn: (row) => get(row.metadata_, 'filename', ''),
//   },
//   {
//     header: 'Size',
//     accessorFn: (row) => row.text.length,
//   },
//   {
//     header: '',
//     id: 'actions',
//     accessorKey: 'id',
//   },
// ];

const columns: Array<
  ColumnDef<{
    detail: string;
    name: string;
  }>
> = [
  {
    header: 'Name',
    accessorKey: 'name',
  },
  {
    header: 'Detail',
    accessorKey: 'detail',
  },
];

function DataSourceInfo() {
  const dataSourceId = useCurrentDataSourceId();
  const { data } = useSourcesServiceGetSource({
    sourceId: dataSourceId,
  });

  const tableData = useMemo(() => {
    if (!data?.embedding_config) {
      return [];
    }

    return Object.entries({
      ...data.embedding_config,
      ...data.metadata_,
    })
      .map(([key, value]) => ({
        name: key,
        detail: typeof value === 'string' ? value : JSON.stringify(value),
      }))
      .filter((row) => row.detail !== undefined);
  }, [data]);

  return <DataTable columns={columns} data={tableData} />;
}

// function DataSourceList() {
//   const dataSourceId = useCurrentDataSourceId();
//   const { data } = useSourcesServiceListSourceDocuments({
//     sourceId: dataSourceId,
//   });
//
//   return (
//     <DataTable
//       columns={dataSourceColumns}
//       data={data || []}
//       isLoading={!data}
//       noResultsText="There are no files in this datasource"
//     />
//   );
// }

interface JobItemProps {
  job: Job;
}

function JobItem(props: JobItemProps) {
  const { job } = props;
  const { metadata_ } = job;

  const contentName = useMemo(() => {
    const filename = metadata_?.filename;

    if (typeof filename === 'string') {
      return `Processing ${filename}`;
    }

    return 'Processing unknown file';
  }, [metadata_?.filename]);

  return (
    <HStack fullWidth>
      <IndeterminateProgress
        content={contentName}
        statusMessage="Indeterminate time"
      />
    </HStack>
  );
}

function DashboardJobList() {
  const { id: userId } = useCurrentUser();
  const { data } = useJobsServiceListActiveJobs({ userId }, undefined, {
    refetchInterval: 5000,
  });

  if (!data || data?.length === 0) {
    return null;
  }

  return (
    <VStack gap={false} fullWidth border rounded>
      <HStack padding="small" borderBottom>
        <Typography bold>Active Jobs</Typography>
      </HStack>
      <VStack paddingX="small" paddingY="large" gap="large" fullWidth>
        {data?.map((job, index) => (
          <Fragment key={job.id}>
            <JobItem key={job.id} job={job} />
            {index !== data.length - 1 && <HStack fullWidth border />}
          </Fragment>
        ))}
      </VStack>
    </VStack>
  );
}

function DataSourceHomePage() {
  return (
    <DashboardPageLayout title="Source Info" actions={<UploadFileDialog />}>
      <DashboardPageSection>
        <DashboardJobList />

        <DataSourceInfo />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default DataSourceHomePage;

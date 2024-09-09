'use client';
import { useCallback, useMemo, useState } from 'react';
import React from 'react';
import {
  Alert,
  Button,
  CopyButton,
  DashboardPageLayout,
  DashboardPageSection,
  DashboardStatusComponent,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DownloadButton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  FormField,
  FormProvider,
  HStack,
  Input,
  PlusIcon,
  TrashIcon,
  Typography,
  useForm,
} from '@letta-web/component-library';
import { DashboardHeader } from '$letta/client/common';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { APIKeyType } from '$letta/any/contracts/api-keys';
import type { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';

const CreateAPIKeySchema = z.object({
  name: z.string(),
});

function CreateAPIKeyDialog() {
  const [generatedKey, setGeneratedKey] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const { mutate, isPending } = webApi.apiKeys.createAPIKey.useMutation({
    onSuccess: (response) => {
      setGeneratedKey(response.body.apiKey);

      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.apiKeys.getAPIKeys,
      });
    },
  });

  const form = useForm<z.infer<typeof CreateAPIKeySchema>>({
    resolver: zodResolver(CreateAPIKeySchema),
    defaultValues: {
      name: '',
    },
  });

  const handleSubmit = useCallback(
    async (values: z.infer<typeof CreateAPIKeySchema>) => {
      mutate({ body: values });
    },
    [mutate]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        preventCloseFromOutside
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            form.reset();
            setGeneratedKey(null);
          }
        }}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending}
        hideConfirm={!!generatedKey}
        cancelText={generatedKey ? 'Close' : 'Cancel'}
        title={generatedKey ? 'API Key Created' : 'Create API Key'}
        trigger={<Button preIcon={<PlusIcon />} label="Create API Key" />}
      >
        {generatedKey ? (
          <>
            <Alert variant="warning" title="API Key Created">
              <Typography>
                We have generated you an API Key, please make sure to store it
                safely.
              </Typography>
              <HStack paddingY="small">
                <DownloadButton
                  textToDownload={generatedKey}
                  fileName="api-key.txt"
                  downloadButtonText="Download API Key"
                />
                <CopyButton
                  textToCopy={generatedKey}
                  copyButtonText="Copy API Key to Clipboard"
                />
              </HStack>
            </Alert>
          </>
        ) : (
          <FormField
            render={({ field }) => {
              return (
                <Input
                  fullWidth
                  {...field}
                  label="Name"
                  description="Provide a descriptive name for identifying for later use"
                />
              );
            }}
            name="name"
          />
        )}
      </Dialog>
    </FormProvider>
  );
}

interface DeleteAPIKeyDialogProps {
  apiKeyId: string;
  name: string;
}

function DeleteAPIKeyDialog(props: DeleteAPIKeyDialogProps) {
  const { apiKeyId, name } = props;
  const queryClient = useQueryClient();
  const { mutate, isPending } = webApi.apiKeys.deleteAPIKey.useMutation({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.apiKeys.getAPIKeys,
      });
    },
  });

  const handleDelete = useCallback(() => {
    mutate({
      params: {
        apiKeyId,
      },
    });
  }, [apiKeyId, mutate]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      onConfirm={handleDelete}
      confirmText="Delete"
      confirmColor="destructive"
      trigger={
        <DropdownMenuLabel preIcon={<TrashIcon />} text="Delete API Key" />
      }
      title={`Delete ${name}`}
    >
      Are you sure you want to delete your API Key? This is permanent and cannot
      be undone.
    </Dialog>
  );
}

const apiKeysColumns: Array<ColumnDef<APIKeyType>> = [
  {
    header: 'Name',
    accessorKey: 'name',
  },
  {
    header: '',
    accessorKey: 'id',
    meta: {
      style: {
        columnAlign: 'right',
      },
    },
    id: 'actions',
    cell: ({ cell }) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              color="tertiary-transparent"
              label="Actions"
              preIcon={<DotsHorizontalIcon />}
              size="small"
              hideLabel
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DeleteAPIKeyDialog
              name={cell.row.original.name}
              apiKeyId={cell.row.original.id}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

const PAGE_SIZE = 10;

function APIKeysPage() {
  const [offset, setOffset] = useState(0);

  const { data, isFetching, isError } = webApi.apiKeys.getAPIKeys.useQuery({
    queryKey: webApiQueryKeys.apiKeys.getAPIKeysWithSearch({
      offset,
      limit: PAGE_SIZE,
    }),
    queryData: {
      query: {
        offset,
        limit: PAGE_SIZE,
      },
    },
  });

  const handleNextPage = useCallback(() => {
    if (isFetching) {
      return;
    }

    setOffset((prev) => prev + PAGE_SIZE);
  }, [isFetching]);

  const handlePreviousPage = useCallback(() => {
    if (isFetching) {
      return;
    }

    setOffset((prev) => prev - PAGE_SIZE);
  }, [isFetching]);

  const hasNextPage = useMemo(() => {
    if (isFetching) {
      return false;
    }

    if (data?.status === 200) {
      return data.body.length >= PAGE_SIZE;
    }

    return false;
  }, [data?.body.length, data?.status, isFetching]);

  const hasPreviousPage = useMemo(() => {
    if (isFetching) {
      return false;
    }

    return offset > 0;
  }, [isFetching, offset]);

  const apiKeys = useMemo(() => {
    if (data?.status === 200) {
      return data.body;
    }

    return undefined;
  }, [data]);

  return (
    <DashboardPageLayout
      header={
        <DashboardHeader
          title="API Keys"
          actions={
            <>
              <CreateAPIKeyDialog />
            </>
          }
        />
      }
    >
      {(!apiKeys || apiKeys.length === 0) && offset === 0 ? (
        <DashboardStatusComponent
          emptyMessage="No API keys found"
          emptyAction={<CreateAPIKeyDialog />}
          isLoading={!apiKeys}
          loadingMessage="Loading API keys"
          isError={isError}
        />
      ) : (
        <DashboardPageSection>
          <DataTable
            isLoading={isFetching}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            onNextPage={handleNextPage}
            onPreviousPage={handlePreviousPage}
            showPagination
            columns={apiKeysColumns}
            data={apiKeys || []}
          />
        </DashboardPageSection>
      )}
    </DashboardPageLayout>
  );
}

export default APIKeysPage;

'use client';
import { useCallback, useMemo, useState } from 'react';
import React from 'react';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  LoadingEmptyStatusComponent,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuLabel,
  FormField,
  FormProvider,
  Input,
  PlusIcon,
  TrashIcon,
  useForm,
} from '@letta-web/component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi, webApiQueryKeys } from '$letta/client';
import type { ColumnDef } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import type { WhitelistedEmailType } from '$letta/web-api/contracts';

const AddWhitelistedEmailSchema = z.object({
  email: z.string().email(),
});

function CreateEmailWhitelist() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { mutate, isPending } =
    webApi.admin.whitelistedEmails.createWhitelistedEmail.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey:
            webApiQueryKeys.admin.whitelistedEmails.getWhitelistedEmails,
        });

        setOpen(false);
      },
    });

  const form = useForm<z.infer<typeof AddWhitelistedEmailSchema>>({
    resolver: zodResolver(AddWhitelistedEmailSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleSubmit = useCallback(
    async (values: z.infer<typeof AddWhitelistedEmailSchema>) => {
      mutate({ body: values });
    },
    [mutate]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={setOpen}
        isOpen={open}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending}
        cancelText="Cancel"
        title="Add Email to Whitelist"
        trigger={
          <Button preIcon={<PlusIcon />} label="Add email to whitelist" />
        }
      >
        <FormField
          render={({ field }) => {
            return (
              <Input
                fullWidth
                {...field}
                label="Email"
                type="email"
                description="Provide an email to whitelist"
              />
            );
          }}
          name="email"
        />
      </Dialog>
    </FormProvider>
  );
}

interface DeleteEmailWhitelist {
  id: string;
  email: string;
}

function RemoveEmailFromWhitelistDialog(props: DeleteEmailWhitelist) {
  const { id, email } = props;
  const queryClient = useQueryClient();
  const { mutate, isPending } =
    webApi.admin.whitelistedEmails.deleteWhitelistedEmail.useMutation({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey:
            webApiQueryKeys.admin.whitelistedEmails.getWhitelistedEmails,
        });
      },
    });

  const handleDelete = useCallback(() => {
    mutate({
      params: {
        whitelistedEmailId: id,
      },
    });
  }, [id, mutate]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      onConfirm={handleDelete}
      confirmText="Remove"
      confirmColor="destructive"
      trigger={
        <DropdownMenuLabel preIcon={<TrashIcon />} text="Remove email" />
      }
      title={`Remove ${email}`}
    >
      Remove ${email} from the whitelist?
    </Dialog>
  );
}

const emailWhitelistColumns: Array<ColumnDef<WhitelistedEmailType>> = [
  {
    header: 'Email',
    accessorKey: 'email',
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
        <DropdownMenu
          trigger={
            <Button
              color="tertiary-transparent"
              label="Actions"
              preIcon={<DotsHorizontalIcon />}
              size="small"
              hideLabel
            />
          }
        >
          <RemoveEmailFromWhitelistDialog
            email={cell.row.original.email}
            id={cell.row.original.id}
          />
        </DropdownMenu>
      );
    },
  },
];

function EmailWhitelistPage() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(10);

  const { data, isFetching, isError } =
    webApi.admin.whitelistedEmails.getWhitelistedEmails.useQuery({
      queryKey:
        webApiQueryKeys.admin.whitelistedEmails.getWhitelistedEmailsWithSearch({
          offset,
          limit,
        }),
      queryData: {
        query: {
          offset,
          limit,
        },
      },
    });

  const emailWhitelist = useMemo(() => {
    if (data?.status === 200) {
      return data.body;
    }

    return undefined;
  }, [data]);

  const [search, setSearch] = useState('');

  return (
    <DashboardPageLayout
      title="Email Whitelist"
      actions={
        <>
          <CreateEmailWhitelist />
        </>
      }
    >
      {(!emailWhitelist || emailWhitelist.emails.length === 0) &&
      offset === 0 ? (
        <LoadingEmptyStatusComponent
          emptyMessage="Nothing in our whitelist? Weird..."
          emptyAction={<CreateEmailWhitelist />}
          isLoading={!emailWhitelist}
          loadingMessage="Loading Email Whitelist"
          isError={isError}
        />
      ) : (
        <DashboardPageSection>
          <DataTable
            onLimitChange={setLimit}
            searchValue={search}
            autofitHeight
            onSearch={setSearch}
            isLoading={isFetching}
            limit={limit}
            offset={offset}
            onSetOffset={setOffset}
            showPagination
            columns={emailWhitelistColumns}
            data={emailWhitelist?.emails || []}
            hasNextPage={emailWhitelist?.hasNextPage}
          />
        </DashboardPageSection>
      )}
    </DashboardPageLayout>
  );
}

export default EmailWhitelistPage;

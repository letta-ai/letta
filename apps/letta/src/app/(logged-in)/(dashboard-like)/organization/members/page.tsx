'use client';

import { useTranslations } from 'next-intl';
import { useCurrentUser } from '$letta/client/hooks';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuLabel,
  FormField,
  FormProvider,
  Input,
  LoadingEmptyStatusComponent,
  Typography,
  useForm,
} from '@letta-web/component-library';
import React, { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  CurrentOrganizationTeamMembersType,
  GetCurrentOrganizationTeamMembersResponseBodyType,
} from '$letta/web-api/organizations/organizationsContracts';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const inviteMemberDialogFormSchema = z.object({
  email: z.string().email(),
});

type InviteMemberDialogFormValues = z.infer<
  typeof inviteMemberDialogFormSchema
>;

function InviteMemberDialog() {
  const { mutate, isPending } =
    webApi.organizations.inviteNewTeamMember.useMutation();

  const t = useTranslations('organization/members');

  const form = useForm<InviteMemberDialogFormValues>({
    resolver: zodResolver(inviteMemberDialogFormSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleInviteMember = useCallback(() => {
    mutate({
      body: {
        email: form.getValues().email,
      },
    });
  }, [mutate, form]);

  return (
    <FormProvider {...form}>
      <Dialog
        title={t('InviteMemberDialog.title')}
        onSubmit={handleInviteMember}
        confirmText={t('InviteMemberDialog.confirm')}
        isConfirmBusy={isPending}
        trigger={
          <Button color="secondary" label={t('InviteMemberDialog.trigger')} />
        }
      >
        <Typography>{t('InviteMemberDialog.description')}</Typography>
        <FormField
          name="email"
          render={({ field }) => {
            return (
              <Input
                fullWidth
                type="email"
                placeholder={t('InviteMemberDialog.email.placeholder')}
                label={t('InviteMemberDialog.email.label')}
                {...field}
              />
            );
          }}
        />
      </Dialog>
    </FormProvider>
  );
}

interface DeleteMemberDialogProps {
  userId: string;
  name: string;
  email: string;
}

function DeleteMemberDialog(props: DeleteMemberDialogProps) {
  const { userId, name, email } = props;
  const t = useTranslations('organization/members');

  const queryClient = useQueryClient();

  const { mutate } = webApi.organizations.removeTeamMember.useMutation({
    onSuccess: () => {
      queryClient.setQueriesData<
        GetCurrentOrganizationTeamMembersResponseBodyType | undefined
      >(
        {
          queryKey:
            webApiQueryKeys.organizations.getCurrentOrganizationTeamMembers,
          exact: false,
        },
        (input) => {
          if (!input) {
            return input;
          }

          return {
            ...input,
            body: {
              ...input.body,
              members: input.body.members.filter(({ id }) => id !== userId),
            },
          };
        }
      );
    },
  });

  const handleRemoveMember = useCallback(() => {
    mutate({
      params: {
        memberId: userId,
      },
    });
  }, [mutate, userId]);

  return (
    <Dialog
      title={t('DeleteMemberDialog.title')}
      onConfirm={handleRemoveMember}
      trigger={<DropdownMenuLabel text={t('DeleteMemberDialog.trigger')} />}
    >
      {t('DeleteMemberDialog.description', {
        name,
        email,
      })}
    </Dialog>
  );
}

function Members() {
  const user = useCurrentUser();
  const t = useTranslations('organization/members');
  const [cursor, setCursor] = useState<
    CurrentOrganizationTeamMembersType | undefined
  >();
  const [limit, setLimit] = useState<number>(30);
  const { data, isFetching, isError } =
    webApi.organizations.getCurrentOrganizationTeamMembers.useQuery({
      queryKey:
        webApiQueryKeys.organizations.getCurrentOrganizationTeamMembersWithSearch(
          {
            cursor: cursor?.id,
            limit,
          }
        ),
      queryData: {
        query: {
          cursor: cursor?.id,
          limit,
        },
      },
    });

  const hasNextPage = useMemo(() => {
    return !!data?.body.nextCursor;
  }, [data?.body.nextCursor]);

  const members: CurrentOrganizationTeamMembersType[] = useMemo(() => {
    if (!data?.body) {
      return [];
    }

    return data.body.members;
  }, [data?.body]);

  const membersColumns: Array<ColumnDef<CurrentOrganizationTeamMembersType>> =
    useMemo(() => {
      return [
        {
          header: t('table.columns.name'),
          accessorKey: 'name',
        },
        {
          header: t('table.columns.email'),
          accessorKey: 'email',
        },
        {
          header: '',
          meta: {
            style: {
              columnAlign: 'right',
            },
          },
          accessorKey: 'id',
          cell: ({ cell }) => {
            if (cell.row.original.id === user?.id) {
              return null;
            }

            return (
              <DropdownMenu
                trigger={
                  <Button
                    data-testid={`api-key-actions-button:${cell.row.original.name}`}
                    color="tertiary-transparent"
                    label={t('table.columns.actions')}
                    preIcon={<DotsHorizontalIcon />}
                    size="small"
                    hideLabel
                  />
                }
                triggerAsChild
              >
                <DeleteMemberDialog
                  name={cell.row.original.email}
                  email={cell.row.original.name}
                  userId={cell.row.original.id}
                />
              </DropdownMenu>
            );
          },
        },
      ];
    }, [t, user?.id]);

  return (
    <DashboardPageLayout title={t('title')} actions={<InviteMemberDialog />}>
      {(!members || members.length === 0) && !cursor ? (
        <LoadingEmptyStatusComponent
          emptyMessage={t('table.emptyError')}
          isLoading={!members}
          errorMessage={t('table.error')}
          loadingMessage={t('table.loading')}
          isError={isError}
        />
      ) : (
        <DashboardPageSection>
          <DataTable
            isLoading={isFetching}
            limit={limit}
            hasNextPage={hasNextPage}
            onSetCursor={setCursor}
            autofitHeight
            onLimitChange={setLimit}
            showPagination
            columns={membersColumns}
            data={members || []}
          />
        </DashboardPageSection>
      )}
    </DashboardPageLayout>
  );
}

export default Members;

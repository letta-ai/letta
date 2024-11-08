'use client';

import { useTranslations } from 'next-intl';
import { useCurrentUser } from '$letta/client/hooks';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DialogTable,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuLabel,
  FormField,
  FormProvider,
  HStack,
  Input,
  LoadingEmptyStatusComponent,
  RawInput,
  SearchIcon,
  toast,
  Typography,
  useForm,
} from '@letta-web/component-library';
import React, { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  CurrentOrganizationTeamMembersType,
  GetCurrentOrganizationTeamMembersResponseBodyType,
  ListInvitedMembersResponseBodyType,
} from '$letta/web-api/organizations/organizationsContracts';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useErrorTranslationMessage } from '@letta-web/helpful-client-utils';

const inviteMemberDialogFormSchema = z.object({
  email: z.string().email(),
});

type InviteMemberDialogFormValues = z.infer<
  typeof inviteMemberDialogFormSchema
>;

function useErrorMessages(error: unknown) {
  const t = useTranslations('organization/members');

  return useErrorTranslationMessage(error, {
    userAlreadyInvited: t('InviteMemberDialog.error.userAlreadyInvited'),
    userAlreadyInOrganization: t(
      'InviteMemberDialog.error.userAlreadyInOrganization'
    ),
    default: t('InviteMemberDialog.error.default'),
  });
}

function InviteMemberDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending, error } =
    webApi.organizations.inviteNewTeamMember.useMutation({
      onSuccess: (res) => {
        if (res.status === 200) {
          toast.success(t('InviteMemberDialog.200success'));

          void queryClient.invalidateQueries({
            queryKey:
              webApiQueryKeys.organizations.getCurrentOrganizationTeamMembers,
            exact: false,
          });

          setIsDialogOpen(false);
          return;
        }

        toast.success(t('InviteMemberDialog.201success'));

        queryClient.setQueriesData<
          ListInvitedMembersResponseBodyType | undefined
        >(
          {
            queryKey:
              webApiQueryKeys.organizations.listInvitedMembersWithSearch({
                limit: LIST_INVITED_MEMBERS_LIMIT,
                search: '',
              }),
            exact: false,
          },
          (data) => {
            if (!data) {
              return data;
            }

            return {
              ...data,
              body: {
                ...data.body,
                members: [
                  ...data.body.members,
                  {
                    email: res.body.email,
                    id: res.body.id,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            };
          }
        );

        setIsDialogOpen(false);
      },
    });

  const t = useTranslations('organization/members');

  const form = useForm<InviteMemberDialogFormValues>({
    resolver: zodResolver(inviteMemberDialogFormSchema),
    defaultValues: {
      email: '',
    },
  });

  const errorMessage = useErrorMessages(error);

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
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        errorMessage={errorMessage}
        title={t('InviteMemberDialog.title')}
        onSubmit={form.handleSubmit(handleInviteMember)}
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

  const { mutate, isPending, isError } =
    webApi.organizations.removeTeamMember.useMutation({
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
      isConfirmBusy={isPending}
      errorMessage={isError ? t('DeleteMemberDialog.error') : undefined}
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

function ExistingMembers() {
  const user = useCurrentUser();
  const [search, setSearch] = useState('');
  const t = useTranslations('organization/members');
  const [offset, setOffset] = useState<number>(0);

  const [limit, setLimit] = useState<number>(30);
  const { data, isFetching, isError } =
    webApi.organizations.getCurrentOrganizationTeamMembers.useQuery({
      queryKey:
        webApiQueryKeys.organizations.getCurrentOrganizationTeamMembersWithSearch(
          {
            offset,
            limit,
            search,
          }
        ),
      queryData: {
        query: {
          offset,
          limit,
          search,
        },
      },
    });

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
    <DashboardPageSection fullHeight>
      {(!members || members.length === 0) && !offset ? (
        <LoadingEmptyStatusComponent
          emptyMessage={t('table.emptyError')}
          isLoading={!data?.body}
          errorMessage={t('table.error')}
          loadingMessage={t('table.loading')}
          isError={isError}
        />
      ) : (
        <DataTable
          searchValue={search}
          onSearch={setSearch}
          isLoading={isFetching}
          limit={limit}
          offset={offset}
          onSetOffset={setOffset}
          hasNextPage={!!data?.body.nextCursor}
          autofitHeight
          onLimitChange={setLimit}
          showPagination
          columns={membersColumns}
          data={members || []}
        />
      )}
    </DashboardPageSection>
  );
}

interface DisInviteMemberButtonProps {
  id: string;
}

function DisInviteMemberButton(props: DisInviteMemberButtonProps) {
  const { id } = props;
  const t = useTranslations('organization/members');

  const query = useQueryClient();

  const { mutate } = webApi.organizations.unInviteTeamMember.useMutation({
    onSuccess: () => {
      query.setQueriesData<ListInvitedMembersResponseBodyType | undefined>(
        {
          queryKey: webApiQueryKeys.organizations.listInvitedMembers,
          exact: false,
        },
        (data) => {
          if (!data) {
            return data;
          }
          return {
            ...data,
            body: {
              ...data.body,
              members: data.body.members.filter((member) => member.id !== id),
            },
          };
        }
      );
    },
  });

  return (
    <Button
      type="button"
      onClick={() => {
        mutate({
          params: {
            memberId: id,
          },
        });
      }}
      size="small"
      color="tertiary"
      label={t('DisInviteMemberButton.dismiss')}
    />
  );
}

const LIST_INVITED_MEMBERS_LIMIT = 30;

function InvitedMembersDialog() {
  const t = useTranslations('organization/members');

  const [search, setSearch] = useState('');

  const { data, isFetching, isError } =
    webApi.organizations.listInvitedMembers.useQuery({
      queryKey: webApiQueryKeys.organizations.listInvitedMembersWithSearch({
        limit: LIST_INVITED_MEMBERS_LIMIT,
        search,
      }),
      queryData: {
        query: {
          limit: LIST_INVITED_MEMBERS_LIMIT,
          search,
        },
      },
    });

  const members = useMemo(() => {
    if (!data?.body) {
      return [];
    }

    return data.body.members.map((member) => ({
      label: member.email,
      id: member.id,
      action: <DisInviteMemberButton id={member.id} />,
    }));
  }, [data?.body]);

  return (
    <Dialog
      size="large"
      title={t('InvitedMembersDialog.title')}
      hideConfirm
      trigger={
        <Button
          color="tertiary-transparent"
          label={t('InvitedMembersDialog.trigger')}
        />
      }
    >
      <HStack>
        <RawInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          postIcon={<SearchIcon />}
          fullWidth
          hideLabel
          label={t('InvitedMembersDialog.searchInput.label')}
          placeholder={t('InvitedMembersDialog.searchInput.placeholder')}
        />
      </HStack>
      <DialogTable
        errorMessage={
          isError ? t('InvitedMembersDialog.table.error') : undefined
        }
        items={members}
        emptyMessage={t('InvitedMembersDialog.table.empty')}
        isLoading={isFetching}
      />
    </Dialog>
  );
}

function Members() {
  const t = useTranslations('organization/members');

  return (
    <DashboardPageLayout
      encapsulatedFullHeight
      title={t('title')}
      actions={
        <HStack>
          <InvitedMembersDialog />
          <InviteMemberDialog />
        </HStack>
      }
    >
      <ExistingMembers />
    </DashboardPageLayout>
  );
}

export default Members;

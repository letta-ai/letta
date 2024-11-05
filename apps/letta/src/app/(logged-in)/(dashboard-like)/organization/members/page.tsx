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
import { inviteNewTeamMemberContract } from '$letta/web-api/organizations/organizationsContracts';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createErrorTranslationFinder } from '@letta-web/helpful-client-utils';

const inviteMemberDialogFormSchema = z.object({
  email: z.string().email(),
});

type InviteMemberDialogFormValues = z.infer<
  typeof inviteMemberDialogFormSchema
>;

const errorMessageFinder = createErrorTranslationFinder(
  inviteNewTeamMemberContract
);

function useErrorMessages(error: unknown) {
  const t = useTranslations('organization/members');

  if (!error) {
    return undefined;
  }

  return {
    userAlreadyInvited: t('InviteMemberDialog.error.userAlreadyInvited'),
    default: t('InviteMemberDialog.error.default'),
  }[errorMessageFinder(error)];
}

function InviteMemberDialog() {
  const { mutate, isPending, error } =
    webApi.organizations.inviteNewTeamMember.useMutation();

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

function ExistingMembers() {
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
    <DashboardPageSection>
      {(!members || members.length === 0) && !cursor ? (
        <LoadingEmptyStatusComponent
          emptyMessage={t('table.emptyError')}
          isLoading={!data?.body}
          errorMessage={t('table.error')}
          loadingMessage={t('table.loading')}
          isError={isError}
        />
      ) : (
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

function InvitedMembersDialog() {
  const t = useTranslations('organization/members');

  const [search, setSearch] = useState('');
  const limit = 30;

  const { data, isFetching, isError } =
    webApi.organizations.listInvitedMembers.useQuery({
      queryKey: webApiQueryKeys.organizations.listInvitedMembersWithSearch({
        limit,
        search,
      }),
      queryData: {
        query: {
          limit,
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

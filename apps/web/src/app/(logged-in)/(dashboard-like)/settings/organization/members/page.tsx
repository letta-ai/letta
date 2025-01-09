'use client';

import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DialogTable,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
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
  useCopyToClipboard,
  useForm,
} from '@letta-cloud/component-library';
import React, { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  CurrentOrganizationTeamMembersType,
  GetCurrentOrganizationTeamMembersResponseBodyType,
  ListInvitedMembersResponseBodyType,
} from '$web/web-api/contracts';
import { webApi, webApiContracts, webApiQueryKeys } from '$web/client';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useErrorTranslationMessage } from '@letta-cloud/helpful-client-utils';
import { environment } from '@letta-cloud/environmental-variables';
import { parseInviteCode } from '$web/utils';

const inviteMemberDialogFormSchema = z.object({
  email: z.string().email(),
});

type InviteMemberDialogFormValues = z.infer<
  typeof inviteMemberDialogFormSchema
>;

function useErrorMessages(error: unknown) {
  const t = useTranslations('organization/members');

  return useErrorTranslationMessage(error, {
    messageMap: {
      userAlreadyInvited: t('InviteMemberDialog.error.userAlreadyInvited'),
      userAlreadyInOrganization: t(
        'InviteMemberDialog.error.userAlreadyInOrganization',
      ),
      default: t('InviteMemberDialog.error.default'),
    },
    contract: webApiContracts.organizations.inviteNewTeamMember,
  });
}

function InviteMemberDialog() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const onClose = useCallback(() => {
    setInviteCode(null);
    setIsDialogOpen(false);
  }, []);

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

          onClose();
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
                    inviteCode: res.body.inviteCode,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            };
          },
        );

        setInviteCode(res.body.inviteCode);
      },
    });

  const t = useTranslations('organization/members');

  const form = useForm<InviteMemberDialogFormValues>({
    resolver: zodResolver(inviteMemberDialogFormSchema),
    defaultValues: {
      email: '',
    },
  });

  const errorTranslation = useErrorMessages(error);

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
        onOpenChange={(open) => {
          if (!open) {
            onClose();

            return;
          }

          setIsDialogOpen(open);
        }}
        errorMessage={errorTranslation?.message}
        title={t('InviteMemberDialog.title')}
        onSubmit={form.handleSubmit(handleInviteMember)}
        confirmText={t('InviteMemberDialog.confirm')}
        isConfirmBusy={isPending}
        trigger={
          <Button color="primary" label={t('InviteMemberDialog.trigger')} />
        }
      >
        {inviteCode ? (
          <>
            <Typography>
              {t('InviteMemberDialog.inviteCode.description')}
            </Typography>
            <Input
              fullWidth
              hideLabel
              label={t('InviteMemberDialog.inviteCode.label')}
              readOnly
              value={generateInviteCodeLink(inviteCode)}
              allowCopy
            />
          </>
        ) : (
          <>
            <Typography>
              {t.rich('InviteMemberDialog.description', {
                bold: (chunks) => (
                  <Typography inline bold>
                    {chunks}
                  </Typography>
                ),
              })}
            </Typography>
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
          </>
        )}
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
          },
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
          },
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
                    color="tertiary"
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
        },
      );
    },
  });

  return (
    <DropdownMenuItem
      onClick={() => {
        mutate({
          params: {
            memberId: id,
          },
        });
      }}
      color="secondary"
      label={t('DisInviteMemberButton.dismiss')}
    />
  );
}

function generateInviteCodeLink(code: string) {
  return `${environment.NEXT_PUBLIC_CURRENT_HOST}/signup-via-invite?code=${code}`;
}

interface RegenerateInviteLinkButtonProps {
  memberId: string;
}

function RegenerateInviteLinkButton(props: RegenerateInviteLinkButtonProps) {
  const { memberId } = props;
  const t = useTranslations('organization/members');
  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: '',
    copySuccessMessage: t('RegenerateInviteLinkButton.success'),
  });

  const query = useQueryClient();

  const { mutate } = webApi.organizations.regenerateInviteCode.useMutation({
    onSuccess: (response) => {
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
              members: data.body.members.map((member) => {
                if (member.id === memberId) {
                  return {
                    ...member,
                    inviteCode: response.body.inviteCode,
                  };
                }

                return member;
              }),
            },
          };
        },
      );

      if (response.body && response.status === 200) {
        void copyToClipboard(generateInviteCodeLink(response.body.inviteCode));
        return;
      }

      toast.error(t('RegenerateInviteLinkButton.error'));
    },
    onError: () => {
      toast.error(t('RegenerateInviteLinkButton.error'));
    },
  });

  return (
    <DropdownMenuItem
      onClick={() => {
        mutate({
          params: {
            memberId,
          },
        });
      }}
      color="secondary"
      label={t('RegenerateInviteLinkButton.action')}
    />
  );
}

interface CopyInviteCodeButtonProps {
  code: string;
}

function CopyInviteCodeButton(props: CopyInviteCodeButtonProps) {
  const { code } = props;
  const t = useTranslations('organization/members');
  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: generateInviteCodeLink(code),
    copySuccessMessage: t('CopyInviteCodeButton.success'),
  });

  return (
    <DropdownMenuItem
      onClick={() => {
        void copyToClipboard();
      }}
      label={t('CopyInviteCodeButton.label')}
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

    return data.body.members.map((member) => {
      const { expiresIn, isExpired } = parseInviteCode(member.inviteCode);

      return {
        label: member.email,
        id: member.id,
        action: (
          <HStack align="center">
            <Typography inline noWrap variant="body3">
              {isExpired
                ? t('InviteMembersDialog.expired')
                : t('InviteMembersDialog.expiresIn', {
                    days: Math.floor(expiresIn / (1000 * 60 * 60 * 24)),
                  })}
            </Typography>
            <DropdownMenu
              align="end"
              triggerAsChild
              trigger={
                <Button
                  hideLabel
                  preIcon={<DotsHorizontalIcon />}
                  size="small"
                  color="tertiary"
                  label={t('InviteMembersDialog.options')}
                />
              }
            >
              <CopyInviteCodeButton code={member.inviteCode} />
              <RegenerateInviteLinkButton memberId={member.id} />
              <DisInviteMemberButton id={member.id} />
            </DropdownMenu>
          </HStack>
        ),
      };
    });
  }, [t, data?.body]);

  return (
    <Dialog
      size="large"
      title={t('InvitedMembersDialog.title')}
      hideConfirm
      trigger={
        <Button color="tertiary" label={t('InvitedMembersDialog.trigger')} />
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

'use client';

import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser, useUserHasPermission } from '$web/client/hooks';
import {
  Button,
  CheckIcon,
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
  isMultiValue,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  RawInput,
  SearchIcon,
  Select,
  toast,
  Typography,
  CloseIcon,
  useCopyToClipboard,
  useForm,
  VStack,
  CompanyIcon,
  KeyIcon,
  LettaInvaderIcon,
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
import {
  ApplicationServices,
  roleToServicesMap,
  UserPresetRoles,
} from '@letta-cloud/rbac';
import type { UserPresetRolesType } from '@letta-cloud/rbac';

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

interface UpdateMemberRoleDialogProps {
  userId: string;
  currentRole: UserPresetRolesType;
}

const updateMemberRoleSchema = z.object({
  role: z.object({
    value: UserPresetRoles,
    label: z.string(),
    description: z.string().optional(),
  }),
});

interface PermissionReferenceSheetProps {
  role: UserPresetRolesType;
}

interface PermissionGrantViewProps {
  service: string;
  hasAccess: boolean;
}

function PermissionGrantView(props: PermissionGrantViewProps) {
  const { service, hasAccess } = props;

  return (
    <HStack>
      <Typography color={hasAccess ? 'positive' : 'destructive'}>
        {hasAccess ? <CheckIcon /> : <CloseIcon />}
      </Typography>
      <Typography>{service}</Typography>
    </HStack>
  );
}

interface PermissionCategoryViewProps {
  title: string;
  icon: React.ReactNode;
  permissions: PermissionGrantViewProps[];
}

function PermissionCategoryView(props: PermissionCategoryViewProps) {
  return (
    <VStack>
      <HStack>
        {props.icon}
        <Typography bold>{props.title}</Typography>
      </HStack>
      <NiceGridDisplay itemWidth="200px">
        {props.permissions.map((permission) => (
          <PermissionGrantView key={permission.service} {...permission} />
        ))}
      </NiceGridDisplay>
    </VStack>
  );
}

function PermissionReferenceSheet(props: PermissionReferenceSheetProps) {
  const { role } = props;
  const t = useTranslations('organization/members');

  const permissions = new Set(roleToServicesMap[role]);

  return (
    <VStack gap="large">
      <PermissionCategoryView
        title={t('permissions.organization.title')}
        icon={<CompanyIcon />}
        permissions={[
          {
            service: t('permissions.organization.update'),
            hasAccess: permissions.has(ApplicationServices.UPDATE_ORGANIZATION),
          },
          {
            service: t('permissions.organization.updateMembers'),
            hasAccess: permissions.has(
              ApplicationServices.UPDATE_USERS_IN_ORGANIZATION,
            ),
          },
          {
            service: t(
              'permissions.organization.updateOrganizationEnvironmentVariables',
            ),
            hasAccess: permissions.has(
              ApplicationServices.UPDATE_ORGANIZATION_ENVIRONMENT_VARIABLES,
            ),
          },
        ]}
      />
      <PermissionCategoryView
        title={t('permissions.apiKeys.title')}
        icon={<KeyIcon />}
        permissions={[
          {
            service: t('permissions.apiKeys.create'),
            hasAccess: permissions.has(ApplicationServices.CREATE_API_KEY),
          },
          {
            service: t('permissions.apiKeys.read'),
            hasAccess: permissions.has(ApplicationServices.READ_API_KEYS),
          },
          {
            service: t('permissions.apiKeys.delete'),
            hasAccess: permissions.has(ApplicationServices.DELETE_API_KEY),
          },
        ]}
      />
      <PermissionCategoryView
        title={t('permissions.agents.title')}
        icon={<LettaInvaderIcon />}
        permissions={[
          {
            service: t('permissions.agents.create'),
            hasAccess: permissions.has(ApplicationServices.CREATE_AGENT),
          },
          {
            service: t('permissions.agents.read'),
            hasAccess: permissions.has(ApplicationServices.READ_AGENT),
          },
          {
            service: t('permissions.agents.delete'),
            hasAccess: permissions.has(ApplicationServices.DELETE_AGENT),
          },
          {
            service: t('permissions.agents.update'),
            hasAccess: permissions.has(ApplicationServices.UPDATE_AGENT),
          },
          {
            service: t('permissions.agents.message'),
            hasAccess: permissions.has(ApplicationServices.MESSAGE_AGENT),
          },
        ]}
      />
    </VStack>
  );
}

type UpdateMemberRoleFormValues = z.infer<typeof updateMemberRoleSchema>;

function UpdateMemberRoleDialog(props: UpdateMemberRoleDialogProps) {
  const { userId, currentRole } = props;

  const t = useTranslations('organization/members');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getLabelForRole = useGetLabelForRole();

  const form = useForm<UpdateMemberRoleFormValues>({
    resolver: zodResolver(updateMemberRoleSchema),
    defaultValues: {
      role: {
        label: getLabelForRole(currentRole),
        value: currentRole,
      },
    },
  });

  const roleOptions = useMemo(() => {
    return Object.values(UserPresetRoles.Enum)
      .map((role) => ({
        value: role,
        label: getLabelForRole(role),
      }))
      .filter((role) => role.value !== 'custom');
  }, [getLabelForRole]);

  const queryClient = useQueryClient();

  const { mutate, isPending, isError } =
    webApi.organizations.updateOrganizationUserRole.useMutation({
      onSuccess: (_, values) => {
        setIsDialogOpen(false);
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
                members: input.body.members.map((member) => {
                  if (member.id === userId) {
                    return {
                      ...member,
                      role: values.body.role,
                    };
                  }

                  return member;
                }),
              },
            };
          },
        );
      },
    });

  const handleUpdateRole = useCallback(
    (values: UpdateMemberRoleFormValues) => {
      mutate({
        params: {
          userId,
        },
        body: {
          role: values.role.value,
        },
      });
    },
    [mutate, userId],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        isConfirmBusy={isPending}
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
        }}
        size="large"
        color="background"
        errorMessage={isError ? t('UpdateMemberRoleDialog.error') : undefined}
        title={t('UpdateMemberRoleDialog.title')}
        onSubmit={form.handleSubmit(handleUpdateRole)}
        trigger={
          <DropdownMenuItem
            color="secondary"
            doNotCloseOnSelect
            label={t('UpdateMemberRoleDialog.trigger')}
          />
        }
      >
        <FormField
          name="role"
          render={({ field }) => {
            return (
              <VStack>
                <Select
                  labelVariant="simple"
                  label={t('UpdateMemberRoleDialog.select.label')}
                  options={roleOptions}
                  onSelect={(value) => {
                    if (isMultiValue(value)) {
                      return;
                    }

                    field.onChange(value);
                  }}
                  value={field.value}
                />
                <VStack paddingTop>
                  <VStack borderTop paddingTop>
                    <PermissionReferenceSheet role={field.value.value} />
                  </VStack>
                </VStack>
              </VStack>
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

function useGetLabelForRole() {
  const t = useTranslations('organization/members');

  return useCallback(
    (role: string) => {
      switch (role) {
        case 'admin':
          return t('roles.admin');
        case 'editor':
          return t('roles.editor');
        case 'custom':
          return t('roles.custom');
        default:
          return role;
      }
    },
    [t],
  );
}

function ExistingMembers() {
  const user = useCurrentUser();
  const [search, setSearch] = useState('');
  const t = useTranslations('organization/members');
  const [offset, setOffset] = useState<number>(0);

  const getLabelForRole = useGetLabelForRole();

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

  const [canUpdateUsers] = useUserHasPermission(
    ApplicationServices.UPDATE_USERS_IN_ORGANIZATION,
  );

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
          header: t('table.columns.role'),
          accessorKey: 'role',
          cell: ({ cell }) => {
            return getLabelForRole(cell.row.original.role);
          },
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
            if (!canUpdateUsers) {
              return null;
            }

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
                <UpdateMemberRoleDialog
                  userId={cell.row.original.id}
                  currentRole={cell.row.original.role}
                />
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
    }, [t, user?.id, getLabelForRole, canUpdateUsers]);

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

  const [canUpdateUsers] = useUserHasPermission(
    ApplicationServices.UPDATE_USERS_IN_ORGANIZATION,
  );

  return (
    <DashboardPageLayout
      encapsulatedFullHeight
      title={t('title')}
      actions={
        canUpdateUsers ? (
          <HStack>
            <InvitedMembersDialog />
            <InviteMemberDialog />
          </HStack>
        ) : null
      }
    >
      <ExistingMembers />
    </DashboardPageLayout>
  );
}

export default Members;

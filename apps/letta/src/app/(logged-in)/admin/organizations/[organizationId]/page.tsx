'use client';
import { useCurrentAdminOrganization } from './hooks/useCurrentAdminOrganization/useCurrentAdminOrganization';
import {
  AsyncSelect,
  Badge,
  Button,
  CompanyIcon,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  FormField,
  FormProvider,
  HStack,
  LoadedTypography,
  OptionTypeSchemaSingle,
  Typography,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCallback, useMemo, useState } from 'react';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import type { ColumnDef } from '@tanstack/react-table';
import type { AdminOrganizationUserType } from '$letta/web-api/admin/organizations/adminOrganizationsContracts';
import { useQueryClient } from '@tanstack/react-query';
import type { contracts } from '$letta/web-api/contracts';
import type { ServerInferResponses } from '@ts-rest/core';
import { useDebouncedValue } from '@mantine/hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

function EnableCloudAccess() {
  const organization = useCurrentAdminOrganization();

  const { mutate, isPending, isError } =
    webApi.admin.organizations.toggleCloudOrganization.useMutation();

  const handleEnableCloudAccess = useCallback(() => {
    mutate(
      {
        params: {
          organizationId: organization?.id || '',
        },
        body: {
          enabledCloud: true,
        },
      },
      {
        onSuccess: () => {
          window.location.reload();
        },
      }
    );
  }, [organization, mutate]);

  return (
    <Dialog
      title="Enable Cloud Access"
      trigger={<Button label="Enable Cloud Access" size="small" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to enable cloud access' : undefined}
      onConfirm={handleEnableCloudAccess}
    >
      <p>Are you sure you want to enable cloud access for this organization?</p>
    </Dialog>
  );
}

function DisableCloudAccess() {
  const organization = useCurrentAdminOrganization();

  const { mutate, isPending, isError } =
    webApi.admin.organizations.toggleCloudOrganization.useMutation();

  const handleDisableCloudAccess = useCallback(() => {
    mutate(
      {
        params: {
          organizationId: organization?.id || '',
        },
        body: {
          enabledCloud: false,
        },
      },
      {
        onSuccess: () => {
          window.location.reload();
        },
      }
    );
  }, [organization, mutate]);

  return (
    <Dialog
      title="Disable Cloud Access"
      trigger={<Button size="small" label="Disable Cloud Access" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to disable cloud access' : undefined}
      onConfirm={handleDisableCloudAccess}
    >
      <p>
        Are you sure you want to disable cloud access for this organization?
        This wont delete any data.
      </p>
    </Dialog>
  );
}

const AddUserToOrganizationSchema = z.object({
  email: OptionTypeSchemaSingle.optional(),
});

function AddUserToOrganizationDialog() {
  const organization = useCurrentAdminOrganization();

  const form = useForm<z.infer<typeof AddUserToOrganizationSchema>>({
    resolver: zodResolver(AddUserToOrganizationSchema),
    defaultValues: {
      email: undefined,
    },
  });

  const { mutate, isPending, isSuccess, isError } =
    webApi.admin.organizations.adminAddUserToOrganization.useMutation();

  const handleAddUser = useCallback(
    async (values: z.infer<typeof AddUserToOrganizationSchema>) => {
      if (!organization) {
        return;
      }

      mutate(
        {
          params: {
            organizationId: organization.id,
          },
          body: {
            userId: values.email?.value || '',
          },
        },
        {
          onSuccess: () => {
            window.location.reload();
          },
        }
      );
    },
    [organization, mutate]
  );

  const loadOptions = useCallback(async (inputValue: string) => {
    const response = await webApi.admin.users.adminGetUsers.query({
      query: {
        search: inputValue,
      },
    });

    if (response.status !== 200) {
      return [];
    }

    return response.body.users.map((user) => ({
      label: user.email,
      value: user.id,
      description: user.name,
    }));
  }, []);

  return (
    <FormProvider {...form}>
      <Dialog
        title="Add User"
        trigger={<Button label="Add User" />}
        isConfirmBusy={isPending && isSuccess}
        errorMessage={isError ? 'Failed to add user' : undefined}
        onSubmit={form.handleSubmit(handleAddUser)}
      >
        <Typography>
          You can only add users that have already signed up for Letta. If you
          want to add a user that has not signed up yet, please create an
          organization on behalf of the user, and then invite them in the
          organization settings.
        </Typography>
        <FormField
          render={({ field }) => (
            <AsyncSelect
              {...field}
              fullWidth
              loadOptions={loadOptions}
              onSelect={(value) => {
                field.onChange(value);
              }}
              value={field.value}
              label="Email"
              placeholder="Start typing an email..."
            />
          )}
          name="email"
        />
      </Dialog>
    </FormProvider>
  );
}

interface RemoveUserFromOrganizationDialogProps {
  userId: string;
}

function RemoveUserFromOrganizationDialog(
  props: RemoveUserFromOrganizationDialogProps
) {
  const { userId } = props;
  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminRemoveUserFromOrganization.useMutation();
  const queryClient = useQueryClient();
  const organization = useCurrentAdminOrganization();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const handleRemoveUser = useCallback(() => {
    if (!organization) {
      return;
    }

    mutate(
      {
        params: {
          organizationId: organization.id,
        },
        body: {
          userId,
        },
      },
      {
        onSuccess: () => {
          queryClient.setQueriesData<
            | ServerInferResponses<
                typeof contracts.admin.organizations.adminListOrganizationUsers,
                200
              >
            | undefined
          >(
            {
              queryKey:
                webApiQueryKeys.admin.organizations.adminListOrganizationUsers(
                  organization.id
                ),
              exact: false,
            },
            (oldData) => {
              if (!oldData) {
                return;
              }
              return {
                ...oldData,
                body: {
                  ...oldData.body,
                  users: oldData.body.users.filter(
                    (user) => user.id !== userId
                  ),
                },
              };
            }
          );

          setIsDialogOpen(false);
        },
      }
    );
  }, [organization, mutate, userId, queryClient]);

  return (
    <Dialog
      title="Remove User"
      onOpenChange={setIsDialogOpen}
      isOpen={isDialogOpen}
      trigger={<DropdownMenuItem doNotCloseOnSelect label="Remove User" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to remove user' : undefined}
      onConfirm={handleRemoveUser}
    >
      <p>Are you sure you want to remove this user from the organization?</p>
    </Dialog>
  );
}

const LIMIT = 5;
function OrganizationMembers() {
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const [debouncedSearch] = useDebouncedValue(search, 500);
  const organization = useCurrentAdminOrganization();

  const organizationId = organization?.id || '';

  const { data, isLoading } =
    webApi.admin.organizations.adminListOrganizationUsers.useQuery({
      queryKey:
        webApiQueryKeys.admin.organizations.adminListOrganizationUsersWithSearch(
          organizationId,
          {
            search: debouncedSearch,
            offset,
            limit: LIMIT,
          }
        ),
      queryData: {
        params: {
          organizationId,
        },
        query: {
          offset,
          search: debouncedSearch,
          limit: LIMIT,
        },
      },
      enabled: !!organizationId,
    });

  const columns: Array<ColumnDef<AdminOrganizationUserType>> = useMemo(
    () => [
      {
        Header: 'Name',
        accessorKey: 'name',
      },
      {
        Header: 'Email',
        accessorKey: 'email',
      },
      {
        Header: 'Actions',
        accessorKey: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu
            trigger={
              <Button
                label="Actions"
                hideLabel
                color="tertiary-transparent"
                preIcon={<DotsHorizontalIcon />}
              />
            }
          >
            <DropdownMenuItem
              label="View User"
              href={`/admin/users/${row.original.id}`}
            />
            <RemoveUserFromOrganizationDialog userId={row.original.id} />
          </DropdownMenu>
        ),
      },
    ],
    []
  );

  return (
    <DashboardPageSection
      title="Members"
      actions={<AddUserToOrganizationDialog />}
    >
      <DataTable
        offset={offset}
        onSetOffset={setOffset}
        onSearch={setSearch}
        limit={LIMIT}
        searchValue={search}
        isLoading={isLoading}
        columns={columns}
        data={data?.body.users || []}
      />
    </DashboardPageSection>
  );
}

function UsageDetails() {
  const startOfThisMonth = useMemo(() => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const endOfThisMonth = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    date.setHours(23, 59, 59, 999);
    return date;
  }, []);

  const organization = useCurrentAdminOrganization();

  const { data, isLoading } =
    webApi.admin.organizations.adminGetOrganizationInferenceUsage.useQuery({
      queryKey:
        webApiQueryKeys.admin.organizations.adminGetOrganizationInferenceUsage(
          'organizationId',
          {
            startDate: startOfThisMonth.getTime(),
            endDate: endOfThisMonth.getTime(),
          }
        ),
      queryData: {
        params: {
          organizationId: organization?.id || '',
        },
        query: {
          startDate: startOfThisMonth.getTime(),
          endDate: endOfThisMonth.getTime(),
        },
      },
      enabled: !!organization,
    });

  const columns = useMemo(() => {
    return [
      {
        header: 'Model Name',
        accessorKey: 'modelName',
      },
      {
        header: 'Total Tokens',
        accessorKey: 'totalTokens',
      },
      {
        header: 'Total Cost',
        accessorKey: 'totalCost',
      },
      {
        header: 'Total Requests',
        accessorKey: 'totalRequests',
      },
    ];
  }, []);

  const [search, setSearch] = useState('');
  const limit = 5;
  const [offset, setOffset] = useState(0);

  const usage = useMemo(() => {
    if (!data?.body) {
      return [];
    }

    return data.body
      .filter((item) => {
        return item.modelName.toLowerCase().includes(search.toLowerCase());
      })
      .slice(offset, offset + limit);
  }, [data?.body, limit, offset, search]);

  return (
    <DashboardPageSection
      title={`Usage Details (${startOfThisMonth.toLocaleDateString()} - ${endOfThisMonth.toLocaleDateString()})`}
    >
      <DataTable
        columns={columns}
        data={usage}
        searchValue={search}
        onSearch={setSearch}
        limit={limit}
        offset={offset}
        onSetOffset={setOffset}
        isLoading={isLoading}
        hasNextPage={usage.length === limit}
      />
    </DashboardPageSection>
  );
}

interface MaybeValueProps {
  value?: number;
  isLoading?: boolean;
}
function MaybeValue(props: MaybeValueProps) {
  const { value, isLoading } = props;

  if (isLoading) {
    return <LoadedTypography fillerText="TEST" />;
  }

  return <Typography>{value || '0'}</Typography>;
}

function OrganizationProperties() {
  const organization = useCurrentAdminOrganization();

  const { data, isLoading } =
    webApi.admin.organizations.adminGetOrganizationStatistics.useQuery({
      queryKey:
        webApiQueryKeys.admin.organizations.adminGetOrganizationStatistics(
          organization?.id || ''
        ),
      queryData: {
        params: {
          organizationId: organization?.id || '',
        },
      },
      enabled: !!organization,
    });

  const properties = useMemo(() => {
    if (!organization) {
      return [];
    }

    return [
      {
        name: 'Cloud Access',
        value: (
          <HStack fullWidth justify="end" align="center">
            {organization.enabledCloudAt ? 'Enabled' : 'Disabled'}
            {organization.enabledCloudAt ? (
              <DisableCloudAccess />
            ) : (
              <EnableCloudAccess />
            )}
          </HStack>
        ),
      },
      {
        name: 'Total Members',
        value: (
          <MaybeValue value={data?.body.totalMembers} isLoading={isLoading} />
        ),
      },
      {
        name: 'Total Templates',
        value: (
          <MaybeValue value={data?.body.totalTemplates} isLoading={isLoading} />
        ),
      },
      {
        name: 'Total Deployed Agents',
        value: (
          <MaybeValue
            value={data?.body.totalDeployedAgents}
            isLoading={isLoading}
          />
        ),
      },
      {
        name: 'Letta Agents Organization ID',
        value: organization.lettaAgentsId || 'None (Bugged Org)',
      },
    ];
  }, [data?.body, isLoading, organization]);

  return (
    <DashboardPageSection title="Organization Properties">
      <DataTable
        columns={[
          {
            header: 'Name',
            accessorKey: 'name',
          },
          {
            header: 'Value',
            meta: {
              style: {
                columnAlign: 'right',
              },
            },
            cell: ({ row }) => row.original.value,
          },
        ]}
        data={properties}
      />
    </DashboardPageSection>
  );
}

function DeleteOrganizationDialog() {
  const organization = useCurrentAdminOrganization();

  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminDeleteOrganization.useMutation();

  const handleDeleteOrganization = useCallback(() => {
    if (!organization) {
      return;
    }

    mutate(
      {
        params: {
          organizationId: organization.id,
        },
      },
      {
        onSuccess: () => {
          window.location.href = '/admin/organizations';
        },
      }
    );
  }, [organization, mutate]);

  return (
    <Dialog
      title="Delete Organization"
      trigger={<Button color="destructive" label="Delete Organization" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to delete organization' : undefined}
      onConfirm={handleDeleteOrganization}
    >
      <p>
        Are you sure you want to delete this organization? This will delete all
        the organization{"'"}s data. This is a hard deletion, please use this as
        a last resort.
      </p>
    </Dialog>
  );
}

function BanOrganizationDialog() {
  const organization = useCurrentAdminOrganization();

  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminBanOrganization.useMutation();

  const handleBanOrganization = useCallback(() => {
    if (!organization) {
      return;
    }

    mutate(
      {
        params: {
          organizationId: organization.id,
        },
      },
      {
        onSuccess: () => {
          window.location.reload();
        },
      }
    );
  }, [organization, mutate]);

  return (
    <Dialog
      title="Ban Organization"
      trigger={<Button color="destructive" label="Ban Organization" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to ban organization' : undefined}
      onConfirm={handleBanOrganization}
    >
      <p>Are you sure you want to ban this organization?</p>
    </Dialog>
  );
}

function UnBanOrganizationDialog() {
  const organization = useCurrentAdminOrganization();

  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminUnbanOrganization.useMutation();

  const handleUnbanOrganization = useCallback(() => {
    if (!organization) {
      return;
    }

    mutate(
      {
        params: {
          organizationId: organization.id,
        },
      },
      {
        onSuccess: () => {
          window.location.reload();
        },
      }
    );
  }, [organization, mutate]);

  return (
    <Dialog
      title="Unban Organization"
      trigger={<Button color="destructive" label="Unban Organization" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to unban organization' : undefined}
      onConfirm={handleUnbanOrganization}
    >
      <p>Are you sure you want to unban this organization?</p>
    </Dialog>
  );
}

function BanSection() {
  const organization = useCurrentAdminOrganization();

  if (!organization) {
    return null;
  }

  if (organization.bannedAt) {
    return <UnBanOrganizationDialog />;
  }

  return <BanOrganizationDialog />;
}

function OrganizationPage() {
  const organization = useCurrentAdminOrganization();
  const { formatDate } = useDateFormatter();

  return (
    <DashboardPageLayout
      returnButton={{
        href: '/admin/organizations',
        text: 'All Organizations',
      }}
    >
      <DashboardPageSection>
        <HStack borderBottom paddingBottom gap="large" align="center">
          <CompanyIcon size="large" />
          <VStack gap={false}>
            <HStack align="center">
              <Typography align="left" variant="heading3">
                {organization?.name}
              </Typography>
              {organization?.bannedAt && (
                <Badge content="Banned" color="destructive" />
              )}
            </HStack>
            <HStack>
              <Typography variant="body">
                Created at{' '}
                {organization?.createdAt
                  ? formatDate(organization.createdAt)
                  : ''}
              </Typography>
            </HStack>
          </VStack>
        </HStack>
      </DashboardPageSection>
      <OrganizationProperties />
      <OrganizationMembers />
      <UsageDetails />
      <DashboardPageSection title="Ban Organization">
        <Typography>
          Banning an organization will ban all users in the organization and
          delete all api keys, all other data will be kept.
        </Typography>
        <HStack>
          <BanSection />
        </HStack>
      </DashboardPageSection>
      <DashboardPageSection title="Delete Organization">
        <Typography>
          Deleting an organization will delete all data associated with the the
          organization. This is a hard deletion, please use this as a last
          resort. Please on Charles you know what you are doing.
        </Typography>
        <HStack>
          <DeleteOrganizationDialog />
        </HStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default OrganizationPage;

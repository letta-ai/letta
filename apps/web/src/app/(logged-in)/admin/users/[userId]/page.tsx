'use client';
import { useAdminCurrentUser } from './hooks/useAdminCurrentUser/useAdminCurrentUser';
import {
  Avatar,
  Badge,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  HStack,
  toast,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import type {
  AdminWholeUserType,
  AdminWholeUserOrganizationType,
} from '$web/web-api/contracts';
import { useFormatters } from '@letta-cloud/utils-client';
import { webApi } from '$web/client';
import type { contracts } from '$web/web-api/contracts';
import { queryClientKeys } from '$web/web-api/contracts';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';

interface UserPageProps {
  user: AdminWholeUserType;
}

function UserOrganizationsList() {
  const user = useAdminCurrentUser();
  const { data, isLoading, error } =
    webApi.admin.users.adminGetUserOrganizations.useQuery({
      queryKey: queryClientKeys.admin.users.adminGetUserOrganizations(
        user?.id || '',
      ),
      queryData: {
        params: {
          userId: user?.id || '',
        },
      },
      enabled: !!user,
    });

  const columns: Array<ColumnDef<AdminWholeUserOrganizationType>> = useMemo(
    () => [
      {
        header: 'Name',
        accessorKey: 'name',
        cell: ({ row }) => (
          <HStack align="center">
            {row.original.name}
            {user?.activeOrganizationId === row.original.id && (
              <Badge variant="info" content="Current" />
            )}
          </HStack>
        ),
      },
      {
        header: 'Actions',
        id: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => (
          <Button
            target="_blank"
            size="small"
            label="View"
            href={`/admin/organizations/${row.original.id}`}
          />
        ),
      },
    ],
    [user?.activeOrganizationId],
  );

  return (
    <DashboardPageSection title="User Organizations">
      <DataTable
        isLoading={isLoading}
        errorMessage={error ? 'Error loading organizations' : undefined}
        columns={columns}
        data={data?.body.organizations || []}
      />
    </DashboardPageSection>
  );
}

function SyncWithHubSpotButton() {
  const { mutate, isPending } =
    webApi.admin.users.adminSyncUserWithHubspot.useMutation();

  const user = useAdminCurrentUser();
  const queryClient = useQueryClient();

  const handleSync = useCallback(() => {
    mutate(
      {
        params: {
          userId: user?.id || '',
        },
      },
      {
        onSuccess: (response) => {
          queryClient.setQueriesData<
            | ServerInferResponses<
                typeof contracts.admin.users.adminGetUser,
                200
              >
            | undefined
          >(
            {
              queryKey: queryClientKeys.admin.users.adminGetUser(
                user?.id || '',
              ),
              exact: true,
            },
            (oldData) => {
              if (!oldData) {
                return oldData;
              }

              return {
                ...oldData,
                body: {
                  ...oldData.body,
                  hubspotContactId: response.body.hubspotContactId,
                },
              };
            },
          );

          toast.success('User synced with Hubspot');
        },
        onError: () => {
          toast.error('Error syncing user with Hubspot');
        },
      },
    );
  }, [mutate, queryClient, user?.id]);

  return (
    <Button
      size="small"
      label="Sync with Hubspot"
      busy={isPending}
      onClick={handleSync}
    />
  );
}

function UserProperties() {
  const user = useAdminCurrentUser();

  const properties = useMemo(() => {
    if (!user) {
      return [];
    }

    return [
      {
        name: 'Hubspot Contact ID',
        value: (
          <HStack fullWidth justify="end" align="center">
            {user.hubspotContactId || 'None'}
            <HStack>
              <Button
                size="small"
                href={`https://app.hubspot.com/contacts/47866676/record/0-1/${user.hubspotContactId}`}
                target="_blank"
                label="View in Hubspot"
              />
              <SyncWithHubSpotButton />
            </HStack>
          </HStack>
        ),
      },
      // TODO: ADD POSTHOG
      {
        name: 'Letta Agents User ID',
        value: user.lettaAgentsUserId || 'None (Bugged User)',
      },
      {
        name: 'Signup Method',
        value: user.signupMethod || 'None (Bugged User)',
      },
    ];
  }, [user]);

  return (
    <DashboardPageSection title="User Properties">
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

function DeleteUserSection() {
  const user = useAdminCurrentUser();

  const { mutate, isPending, isError } =
    webApi.admin.users.adminDeleteUser.useMutation();

  const handleDelete = useCallback(() => {
    mutate(
      {
        params: {
          userId: user?.id || '',
        },
      },
      {
        onSuccess: () => {
          window.location.href = '/admin/users';
        },
      },
    );
  }, [mutate, user?.id]);

  return (
    <DashboardPageSection title="Delete User">
      <Typography>
        You can delete a user by pressing the button below. This will not delete
        any organizations they are associated with. Generally it is better to
        ban a user and their organizations than to delete it, this is more to
        debug users or clear old space.
      </Typography>
      <HStack>
        <Dialog
          errorMessage={isError ? 'Error deleting user' : undefined}
          title="Delete User"
          onConfirm={handleDelete}
          confirmText="Delete"
          isConfirmBusy={isPending}
          trigger={<Button color="destructive" label="Delete User" />}
        >
          <Typography>
            Are you sure you want to delete this user? This will not delete any
            organizations they are associated with.
          </Typography>
        </Dialog>
      </HStack>
    </DashboardPageSection>
  );
}

function UserPage(props: UserPageProps) {
  const { user } = props;
  const { imageUrl, name, email } = user;

  const { formatDate } = useFormatters();

  return (
    <DashboardPageLayout
      returnButton={{
        href: '/admin/users',
        text: 'All Users',
      }}
    >
      <DashboardPageSection>
        <HStack borderBottom paddingBottom gap="large" align="center">
          <Avatar size="large" name={user.name} imageSrc={imageUrl} />
          <VStack gap={false}>
            <Typography align="left" variant="heading3">
              {name}
            </Typography>
            <HStack>
              <Typography align="left" variant="body">
                {email}
              </Typography>
              <Typography variant="body">
                Member since {formatDate(user.createdAt)}
              </Typography>
            </HStack>
          </VStack>
        </HStack>
      </DashboardPageSection>
      <UserProperties />
      <UserOrganizationsList />
      <DashboardPageSection title="Ban User">
        <Typography>
          To ban a user, you must ban their organization first, they and all
          other users in that organization will be banned.
        </Typography>
      </DashboardPageSection>
      <DeleteUserSection />
    </DashboardPageLayout>
  );
}

function UserPageWrapper() {
  const user = useAdminCurrentUser();

  if (!user) {
    return 'Loading user...';
  }

  return <UserPage user={user} />;
}

export default UserPageWrapper;

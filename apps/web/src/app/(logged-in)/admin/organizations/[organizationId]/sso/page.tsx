'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { useCurrentAdminOrganization } from '../hooks/useCurrentAdminOrganization/useCurrentAdminOrganization';
import {
  type contracts,
  type SSOConfigurationType,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';

const AddSSOConfigurationToOrg = z.object({
  domain: z.string(),
  workOSOrganizationId: z.string(),
});

function AddSSOConfigurationToOrgDialog() {
  const organization = useCurrentAdminOrganization();

  const form = useForm<z.infer<typeof AddSSOConfigurationToOrg>>({
    resolver: zodResolver(AddSSOConfigurationToOrg),
    defaultValues: {
      domain: '',
      workOSOrganizationId: '',
    },
  });

  const { mutate, isPending, isSuccess, isError } =
    webApi.admin.organizations.adminAddSSOConfiguration.useMutation();

  const handleAddUser = useCallback(
    async (values: z.infer<typeof AddSSOConfigurationToOrg>) => {
      if (!organization) {
        return;
      }

      mutate(
        {
          params: {
            organizationId: organization.id,
          },
          body: {
            domain: values.domain,
            workOSOrganizationId: values.workOSOrganizationId,
          },
        },
        {
          onSuccess: () => {
            window.location.reload();
          },
        },
      );
    },
    [organization, mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title="Add configruation"
        trigger={<Button label="Add Configuration" />}
        isConfirmBusy={isPending && isSuccess}
        errorMessage={isError ? 'Failed to configuraton user' : undefined}
        onSubmit={form.handleSubmit(handleAddUser)}
      >
        <FormField
          render={({ field }) => (
            <Input
              {...field}
              label="Domain"
              fullWidth
              placeholder="example.com"
            />
          )}
          name="domain"
        />
        <FormField
          render={({ field }) => (
            <Input
              {...field}
              fullWidth
              label="WorkOS Organization Id"
              placeholder="org_123456"
              description="You can find this in the WorkOS dashboard"
            />
          )}
          name="workOSOrganizationId"
        />
      </Dialog>
    </FormProvider>
  );
}

interface RemoveSSOConfigurationProps {
  ssoConfigurationId: string;
}

function RemoveSSOConfiguration(props: RemoveSSOConfigurationProps) {
  const { ssoConfigurationId } = props;
  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminDeleteSSOConfiguration.useMutation();
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
          ssoConfigurationId,
        },
      },
      {
        onSuccess: () => {
          queryClient.setQueriesData<
            | ServerInferResponses<
                typeof contracts.admin.organizations.adminListSSOConfigurations,
                200
              >
            | undefined
          >(
            {
              queryKey: webApiQueryKeys.admin.organizations
                .adminListSSOConfigurationsWithSearch(organization.id, {
                  offset: 0,
                  limit: 0,
                })
                .slice(0, -1),
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
                  users: oldData.body.configurations.filter(
                    (config) => config.id !== ssoConfigurationId,
                  ),
                },
              };
            },
          );

          setIsDialogOpen(false);
        },
      },
    );
  }, [organization, mutate, ssoConfigurationId, queryClient]);

  return (
    <Dialog
      title="Remove Configuration"
      onOpenChange={setIsDialogOpen}
      isOpen={isDialogOpen}
      trigger={<DropdownMenuItem doNotCloseOnSelect label="Remove" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to remove configuration' : undefined}
      onConfirm={handleRemoveUser}
    >
      <p>
        Are you sure you want to remove this SSO configuration from the
        organization?
      </p>
    </Dialog>
  );
}

export default function SSOConfigurationPage() {
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(0);

  const organization = useCurrentAdminOrganization();

  const organizationId = organization?.id || '';

  const { data, isLoading } =
    webApi.admin.organizations.adminListSSOConfigurations.useQuery({
      queryKey:
        webApiQueryKeys.admin.organizations.adminListSSOConfigurationsWithSearch(
          organizationId,
          {
            offset,
            limit,
          },
        ),
      queryData: {
        params: {
          organizationId,
        },
        query: {
          offset,
          limit,
        },
      },
      enabled: !!organizationId && limit > 0,
    });

  const columns: Array<ColumnDef<SSOConfigurationType>> = useMemo(
    () => [
      {
        header: 'Domain',
        accessorKey: 'domain',
      },
      {
        header: 'WorkOS Organization Id',
        accessorKey: 'workOSOrganizationId',
      },
      {
        header: 'Actions',
        accessorKey: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu
            triggerAsChild
            trigger={
              <Button
                label="Actions"
                hideLabel
                color="tertiary"
                preIcon={<DotsHorizontalIcon />}
              />
            }
          >
            <RemoveSSOConfiguration ssoConfigurationId={row.original.id} />
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  return (
    <DashboardPageLayout
      title="SSO Configuration"
      encapsulatedFullHeight
      actions={<AddSSOConfigurationToOrgDialog />}
    >
      <DashboardPageSection fullHeight>
        <DataTable
          offset={offset}
          onSetOffset={setOffset}
          autofitHeight
          limit={limit}
          onLimitChange={setLimit}
          isLoading={isLoading}
          columns={columns}
          data={data?.body.configurations || []}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

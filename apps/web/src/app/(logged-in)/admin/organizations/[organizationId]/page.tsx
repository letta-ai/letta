'use client';
import { useCurrentAdminOrganization } from './hooks/useCurrentAdminOrganization/useCurrentAdminOrganization';
import {
  AsyncSelect,
  Badge,
  Button,
  ChipSelect,
  CompanyIcon,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  DotsHorizontalIcon,
  DropdownMenu,
  DropdownMenuItem,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HStack,
  Input,
  LoadedTypography,
  LoadingEmptyStatusComponent,
  OptionTypeSchemaSingle,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/component-library';
import { webApi, webApiQueryKeys } from '$web/client';
import React, { useCallback, useMemo, useState } from 'react';
import {
  useDateFormatter,
  useMonthCursor,
} from '@letta-cloud/helpful-client-utils';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  AdminOrganizationRateLimitItemType,
  AdminOrganizationUserType,
  AdminOrganizationVerifiedDomainType,
} from '$web/web-api/contracts';
import { useQueryClient } from '@tanstack/react-query';
import type { contracts } from '$web/web-api/contracts';
import type { ServerInferResponses } from '@ts-rest/core';
import { useDebouncedValue } from '@mantine/hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrencyFormatter } from '@letta-cloud/helpful-client-utils';
import { creditsToDollars } from '@letta-cloud/generic-utils';
import { useNumberFormatter } from '@letta-cloud/helpful-client-utils';
import { PricingModelEnum } from '@letta-cloud/types';

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
      },
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
      },
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

const OrganizationBillingSettingsSchema = z.object({
  pricingModel: PricingModelEnum,
  monthlyCreditAllocation: z.number(),
});

type OrganizationBillingSettingsFormValues = z.infer<
  typeof OrganizationBillingSettingsSchema
>;

interface OrganizationBillingSettingsFormProps {
  defaultValues: OrganizationBillingSettingsFormValues;
}

function OrganizationBillingSettingsForm(
  props: OrganizationBillingSettingsFormProps,
) {
  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminUpdateOrganizationBillingSettings.useMutation();
  const organization = useCurrentAdminOrganization();

  const form = useForm<OrganizationBillingSettingsFormValues>({
    resolver: zodResolver(OrganizationBillingSettingsSchema),
    defaultValues: props.defaultValues,
  });

  const handleUpdateBillingSettings = useCallback(
    (values: OrganizationBillingSettingsFormValues) => {
      if (!organization) {
        return;
      }

      mutate({
        params: {
          organizationId: organization.id,
        },
        body: values,
      });
    },
    [organization, mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleUpdateBillingSettings)}>
        <FormField
          render={({ field }) => (
            <ChipSelect
              onChange={(value) => {
                const nextValue = value[0];

                field.onChange(nextValue.value);
              }}
              value={[
                {
                  label:
                    field.value === 'prepay' ? 'Prepay' : 'Credits Per Month',
                  value: field.value,
                },
              ]}
              options={[
                {
                  label: 'Prepay',
                  value: 'prepay',
                },
                {
                  label: 'Credits Per Month',
                  value: 'cpm',
                },
              ]}
              fullWidth
              label="Pricing Model"
            />
          )}
          name="pricingModel"
        />
        <FormField
          render={({ field }) => (
            <Input
              {...field}
              fullWidth
              label="Monthly Credit Allocation (only for Credits Per Month)"
              placeholder="Enter monthly credit allocation"
            />
          )}
          name="monthlyCreditAllocation"
        />
        <FormActions
          errorMessage={
            isError ? 'Failed to update billing settings' : undefined
          }
        >
          <Button busy={isPending} label="Update Billing Settings" />
        </FormActions>
      </Form>
    </FormProvider>
  );
}

const verifiedDomainsSchema = z.object({
  domain: z.string(),
});

function AddVerifiedDomainDialog() {
  const [open, setOpen] = useState(false);

  const organization = useCurrentAdminOrganization();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof verifiedDomainsSchema>>({
    resolver: zodResolver(verifiedDomainsSchema),
    defaultValues: {
      domain: '',
    },
  });

  const {
    mutate: addDomain,
    isPending: isAddPending,
    isError: isAddError,
    reset,
  } = webApi.admin.organizations.adminAddVerifiedDomain.useMutation({
    onSuccess: () => {
      queryClient.setQueriesData<
        | ServerInferResponses<
            typeof contracts.admin.organizations.adminGetOrganizationVerifiedDomains,
            200
          >
        | undefined
      >(
        {
          queryKey:
            webApiQueryKeys.admin.organizations.adminGetOrganizationVerifiedDomains(
              organization?.id || '',
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
              domains: [
                ...oldData.body.domains,
                {
                  domain: form.getValues().domain,
                },
              ],
            },
          };
        },
      );

      reset();
      form.reset();

      setOpen(false);
    },
  });

  const handleAddDomain = useCallback(
    async (values: z.infer<typeof verifiedDomainsSchema>) => {
      if (!organization) {
        return;
      }

      addDomain({
        params: {
          organizationId: organization.id,
        },
        body: {
          domain: values.domain,
        },
      });
    },
    [organization, addDomain],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title="Add Verified Domain"
        isOpen={open}
        onOpenChange={setOpen}
        trigger={<Button label="Add Verified Domain" />}
        isConfirmBusy={isAddPending}
        errorMessage={isAddError ? 'Failed to add domain' : undefined}
        onSubmit={form.handleSubmit(handleAddDomain)}
      >
        <FormField
          render={({ field }) => (
            <Input
              {...field}
              fullWidth
              label="Domain"
              placeholder="Enter domain"
            />
          )}
          name="domain"
        />
      </Dialog>
    </FormProvider>
  );
}

interface DeleteVerifiedDomainDialogProps {
  domain: string;
}

function DeleteVerifiedDomainDialog(props: DeleteVerifiedDomainDialogProps) {
  const { domain } = props;
  const organization = useCurrentAdminOrganization();
  const [open, setOpen] = useState(false);

  const queryClient = useQueryClient();

  const { mutate, isPending, isError, reset } =
    webApi.admin.organizations.adminDeleteOrganizationVerifiedDomain.useMutation(
      {
        onSuccess: () => {
          queryClient.setQueriesData<
            | ServerInferResponses<
                typeof contracts.admin.organizations.adminGetOrganizationVerifiedDomains,
                200
              >
            | undefined
          >(
            {
              queryKey:
                webApiQueryKeys.admin.organizations.adminGetOrganizationVerifiedDomains(
                  organization?.id || '',
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
                  domains: oldData.body.domains.filter(
                    (d: AdminOrganizationVerifiedDomainType) =>
                      d.domain !== domain,
                  ),
                },
              };
            },
          );

          reset();
          setOpen(false);
        },
      },
    );

  const handleDeleteDomain = useCallback(
    (domain: string) => {
      if (!organization) {
        return;
      }

      mutate({
        params: {
          organizationId: organization.id,
        },
        body: {
          domain,
        },
      });
    },
    [organization, mutate],
  );

  return (
    <Dialog
      isOpen={open}
      onOpenChange={setOpen}
      title="Delete Domain"
      trigger={<Button size="small" label="Delete" color="destructive" />}
      isConfirmBusy={isPending}
      errorMessage={isError ? 'Failed to delete domain' : undefined}
      onConfirm={() => {
        handleDeleteDomain(domain);
      }}
    >
      <p>Are you sure you want to delete this domain?</p>
    </Dialog>
  );
}

function VerifiedDomains() {
  const organization = useCurrentAdminOrganization();

  const { data, isLoading } =
    webApi.admin.organizations.adminGetOrganizationVerifiedDomains.useQuery({
      queryKey:
        webApiQueryKeys.admin.organizations.adminGetOrganizationVerifiedDomains(
          organization?.id || '',
        ),
      queryData: {
        params: {
          organizationId: organization?.id || '',
        },
      },
      enabled: !!organization,
    });

  const columns: Array<ColumnDef<AdminOrganizationVerifiedDomainType>> =
    useMemo(() => {
      return [
        {
          header: 'Domain',
          accessorKey: 'domain',
        },
        {
          header: 'Actions',
          meta: {
            style: {
              columnAlign: 'right',
            },
          },
          id: 'actions',
          cell: ({ row }) => (
            <DeleteVerifiedDomainDialog domain={row.original.domain} />
          ),
        },
      ];
    }, []);

  return (
    <DashboardPageSection
      title="Verified Domains"
      actions={<AddVerifiedDomainDialog />}
    >
      <DataTable
        columns={columns}
        data={data?.body.domains || []}
        isLoading={isLoading}
        limit={5}
      />
    </DashboardPageSection>
  );
}

function OrganizationBillingSettings() {
  const organization = useCurrentAdminOrganization();

  const { data } =
    webApi.admin.organizations.adminGetOrganizationBillingSettings.useQuery({
      queryKey:
        webApiQueryKeys.admin.organizations.adminGetOrganizationBillingSettings(
          organization?.id || '',
        ),
      queryData: {
        params: {
          organizationId: organization?.id || '',
        },
      },
      enabled: !!organization,
    });

  return (
    <DashboardPageSection title="Billing Settings">
      {!data?.body ? (
        <LoadingEmptyStatusComponent isLoading />
      ) : (
        <OrganizationBillingSettingsForm defaultValues={data.body} />
      )}
    </DashboardPageSection>
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
        },
      );
    },
    [organization, mutate],
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
  props: RemoveUserFromOrganizationDialogProps,
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
                  organization.id,
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
                    (user) => user.id !== userId,
                  ),
                },
              };
            },
          );

          setIsDialogOpen(false);
        },
      },
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
          },
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
            <DropdownMenuItem
              label="View User"
              href={`/admin/users/${row.original.id}`}
            />
            <RemoveUserFromOrganizationDialog userId={row.original.id} />
          </DropdownMenu>
        ),
      },
    ],
    [],
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
  const { startOfMonth, moveToNextMonth, moveToPrevMonth, endOfMonth } =
    useMonthCursor();

  const organization = useCurrentAdminOrganization();

  const { data, isLoading } =
    webApi.admin.organizations.adminGetOrganizationInferenceUsage.useQuery({
      queryKey:
        webApiQueryKeys.admin.organizations.adminGetOrganizationInferenceUsage(
          organization?.id || '',
          {
            startDate: startOfMonth.getTime(),
            endDate: endOfMonth.getTime(),
          },
        ),
      queryData: {
        params: {
          organizationId: organization?.id || '',
        },
        query: {
          startDate: startOfMonth.getTime(),
          endDate: endOfMonth.getTime(),
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
      title={`Usage Details for ${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}`}
      actions={
        <HStack>
          <Button label="Previous Month" onClick={moveToPrevMonth} />
          <Button label="Next Month" onClick={moveToNextMonth} />
        </HStack>
      }
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
          organization?.id || '',
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
      },
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
      },
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

function CreditTransactionHistory() {
  const limit = 5;
  const [offset, setOffset] = useState(0);
  const organization = useCurrentAdminOrganization();

  const { data, isLoading } =
    webApi.admin.organizations.adminListOrganizationCreditTransactions.useQuery(
      {
        queryKey:
          webApiQueryKeys.admin.organizations.adminListOrganizationCreditTransactionsWithSearch(
            organization?.id || '',
            {
              limit,
              offset,
            },
          ),
        queryData: {
          params: {
            organizationId: organization?.id || '',
          },
          query: {
            limit,
            offset,
          },
        },
        enabled: !!organization,
      },
    );

  const columns = useMemo(() => {
    return [
      {
        header: 'Amount',
        accessorKey: 'amount',
      },
      {
        header: 'Notes',
        accessorKey: 'note',
      },
      {
        header: 'Transaction Type',
        accessorKey: 'transactionType',
      },
      {
        header: 'Created At',
        accessorKey: 'createdAt',
      },
    ];
  }, []);

  return (
    <DataTable
      columns={columns}
      data={data?.body.transactions || []}
      limit={limit}
      offset={offset}
      onSetOffset={setOffset}
      isLoading={isLoading}
      hasNextPage={data?.body.transactions.length === limit}
    />
  );
}

function RemoveCreditsDialog() {
  const organization = useCurrentAdminOrganization();

  const form = useForm<z.infer<typeof creditsToAddSchema>>({
    resolver: zodResolver(creditsToAddSchema),
    defaultValues: {
      amount: 0,
      note: '',
    },
  });

  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminRemoveCreditsFromOrganization.useMutation();

  const handleRemoveCredits = useCallback(
    async (values: z.infer<typeof creditsToAddSchema>) => {
      if (!organization) {
        return;
      }

      mutate(
        {
          params: {
            organizationId: organization.id,
          },
          body: {
            amount: values.amount,
            note: values.note,
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
        title="Remove Credits"
        trigger={
          <Button size="small" color="destructive" label="Remove Credits" />
        }
        isConfirmBusy={isPending}
        errorMessage={isError ? 'Failed to remove credits' : undefined}
        onSubmit={form.handleSubmit(handleRemoveCredits)}
      >
        <FormField
          render={({ field }) => (
            <Input
              type="number"
              {...field}
              fullWidth
              label="Amount"
              placeholder="Enter amount"
            />
          )}
          name="amount"
        />
        <FormField
          render={({ field }) => (
            <Input {...field} fullWidth label="Note" placeholder="Enter note" />
          )}
          name="note"
        />
      </Dialog>
    </FormProvider>
  );
}

const creditsToAddSchema = z.object({
  amount: z.coerce.number().positive().int(),
  note: z.string().optional(),
});

function AddCreditsDialog() {
  const organization = useCurrentAdminOrganization();

  const form = useForm<z.infer<typeof creditsToAddSchema>>({
    resolver: zodResolver(creditsToAddSchema),
    defaultValues: {
      amount: 0,
      note: '',
    },
  });

  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminAddCreditsToOrganization.useMutation();

  const handleAddCredits = useCallback(
    async (values: z.infer<typeof creditsToAddSchema>) => {
      if (!organization) {
        return;
      }

      mutate(
        {
          params: {
            organizationId: organization.id,
          },
          body: {
            amount: values.amount,
            note: values.note,
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
        title="Add Credits"
        trigger={<Button size="small" label="Add Credits" />}
        isConfirmBusy={isPending}
        errorMessage={isError ? 'Failed to add credits' : undefined}
        onSubmit={form.handleSubmit(handleAddCredits)}
      >
        <FormField
          render={({ field }) => (
            <Input
              type="number"
              {...field}
              fullWidth
              label="Amount"
              placeholder="Enter amount"
            />
          )}
          name="amount"
        />
        <FormField
          render={({ field }) => (
            <Input {...field} fullWidth label="Note" placeholder="Enter note" />
          )}
          name="note"
        />
      </Dialog>
    </FormProvider>
  );
}

function CreditSection() {
  const organization = useCurrentAdminOrganization();

  const { data } =
    webApi.admin.organizations.adminGetOrganizationCredits.useQuery({
      queryKey: webApiQueryKeys.admin.organizations.adminGetOrganizationCredits(
        organization?.id || '',
      ),
      queryData: {
        params: {
          organizationId: organization?.id || '',
        },
      },
      enabled: !!organization,
    });

  const { formatNumber } = useNumberFormatter();

  const credits = useMemo(() => {
    if (!data?.body) {
      return '-';
    }

    return formatNumber(data.body.credits);
  }, [data?.body, formatNumber]);

  const { formatCurrency } = useCurrencyFormatter();

  const creditValue = useMemo(() => {
    if (!data?.body) {
      return '';
    }

    return `(${formatCurrency(creditsToDollars(data.body.credits))})`;
  }, [data?.body, formatCurrency]);

  return (
    <DashboardPageSection title="Credits">
      <VStack gap={false}>
        <HStack
          align="center"
          justify="spaceBetween"
          fullWidth
          padding="small"
          borderX
          borderTop
        >
          <HStack>
            <Typography>Total Credits: </Typography>
            <Typography>
              {credits} {creditValue}{' '}
            </Typography>
          </HStack>
          <HStack>
            <AddCreditsDialog />
            <RemoveCreditsDialog />
          </HStack>
        </HStack>
        <CreditTransactionHistory />
      </VStack>
    </DashboardPageSection>
  );
}

interface ResetOrganizationRateLimitDialogProps {
  modelId: string;
}

function ResetOrganizationRateLimitDialog(
  props: ResetOrganizationRateLimitDialogProps,
) {
  const organization = useCurrentAdminOrganization();

  const { modelId } = props;

  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminResetOrganizationRateLimitsForModel.useMutation();

  const handleResetOrganizationRateLimit = useCallback(() => {
    if (!organization) {
      return;
    }

    mutate(
      {
        params: {
          modelId,
          organizationId: organization.id,
        },
      },
      {
        onSuccess: () => {
          window.location.reload();
        },
      },
    );
  }, [organization, mutate, modelId]);

  return (
    <Dialog
      title="Reset Organization Rate Limit"
      trigger={
        <DropdownMenuItem
          doNotCloseOnSelect
          label="Reset Organization Rate Limit"
        />
      }
      isConfirmBusy={isPending}
      errorMessage={
        isError ? 'Failed to reset organization rate limit' : undefined
      }
      onConfirm={handleResetOrganizationRateLimit}
    >
      <p>Are you sure you want to reset the organization rate limit?</p>
    </Dialog>
  );
}

const createOrganizationRateLimitSchema = z.object({
  modelId: OptionTypeSchemaSingle,
  maxRequestsPerMinute: z.coerce.number().positive().int(),
  maxTokensPerMinute: z.coerce.number().positive().int(),
});

function CreateOrganizationRateLimitDialog() {
  const organization = useCurrentAdminOrganization();

  const form = useForm<z.infer<typeof createOrganizationRateLimitSchema>>({
    resolver: zodResolver(createOrganizationRateLimitSchema),
    defaultValues: {
      maxRequestsPerMinute: 0,
      maxTokensPerMinute: 0,
    },
  });

  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminUpdateOrganizationRateLimitsForModel.useMutation();

  const handleCreateOrganizationRateLimit = useCallback(
    async (values: z.infer<typeof createOrganizationRateLimitSchema>) => {
      if (!organization) {
        return;
      }

      mutate(
        {
          params: {
            modelId: values.modelId.value || '',
            organizationId: organization.id,
          },
          body: {
            maxInferenceRequestsPerMinute: values.maxRequestsPerMinute,
            maxInferenceTokensPerMinute: values.maxTokensPerMinute,
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

  const getModels = useCallback(async (inputValue: string) => {
    const response = await webApi.admin.models.getAdminInferenceModels.query({
      query: {
        search: inputValue,
      },
    });

    if (response.status !== 200) {
      return [];
    }

    return response.body.inferenceModels.map((model) => ({
      label: model.name,
      value: model.id,
    }));
  }, []);

  return (
    <FormProvider {...form}>
      <Dialog
        title="Create Organization Rate Limit"
        trigger={<Button label="Create Organization Rate Limit" />}
        isConfirmBusy={isPending}
        errorMessage={
          isError ? 'Failed to create organization rate limit' : undefined
        }
        onSubmit={form.handleSubmit(handleCreateOrganizationRateLimit)}
      >
        <FormField
          render={({ field }) => (
            <AsyncSelect
              label="Model"
              {...field}
              fullWidth
              loadOptions={getModels}
              onSelect={(value) => {
                field.onChange(value);
              }}
              value={field.value}
              placeholder="Start typing a model name..."
            />
          )}
          name="modelId"
        />
        <FormField
          render={({ field }) => (
            <Input
              type="number"
              {...field}
              fullWidth
              label="Max Requests Per Minute"
              placeholder="Enter max requests per minute"
            />
          )}
          name="maxRequestsPerMinute"
        />
        <FormField
          render={({ field }) => (
            <Input
              type="number"
              {...field}
              fullWidth
              label="Max Tokens Per Minute"
              placeholder="Enter max tokens per minute"
            />
          )}
          name="maxTokensPerMinute"
        />
      </Dialog>
    </FormProvider>
  );
}

const updateOrganizationRateLimitSchema = z.object({
  maxRequestsPerMinute: z.coerce.number().positive().int(),
  maxTokensPerMinute: z.coerce.number().positive().int(),
});

interface UpdateOrganizationRateLimitDialogProps {
  modelId: string;
  defaultValues: z.infer<typeof updateOrganizationRateLimitSchema>;
}

function UpdateOrganizationRateLimitDialog(
  props: UpdateOrganizationRateLimitDialogProps,
) {
  const { modelId, defaultValues } = props;
  const organization = useCurrentAdminOrganization();

  const form = useForm<z.infer<typeof updateOrganizationRateLimitSchema>>({
    resolver: zodResolver(updateOrganizationRateLimitSchema),
    defaultValues: defaultValues,
  });

  const { mutate, isPending, isError } =
    webApi.admin.organizations.adminUpdateOrganizationRateLimitsForModel.useMutation();

  const handleUpdateOrganizationRateLimit = useCallback(
    async (values: z.infer<typeof updateOrganizationRateLimitSchema>) => {
      if (!organization) {
        return;
      }

      mutate(
        {
          params: {
            modelId,
            organizationId: organization.id,
          },
          body: {
            maxInferenceRequestsPerMinute: values.maxRequestsPerMinute,
            maxInferenceTokensPerMinute: values.maxTokensPerMinute,
          },
        },
        {
          onSuccess: () => {
            window.location.reload();
          },
        },
      );
    },
    [organization, mutate, modelId],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title="Update Organization Rate Limit"
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            label="Update Organization Rate Limit"
          />
        }
        isConfirmBusy={isPending}
        errorMessage={
          isError ? 'Failed to update organization rate limit' : undefined
        }
        onSubmit={form.handleSubmit(handleUpdateOrganizationRateLimit)}
      >
        <FormField
          render={({ field }) => (
            <Input
              type="number"
              {...field}
              fullWidth
              label="Max Requests Per Minute"
              placeholder="Enter max requests per minute"
            />
          )}
          name="maxRequestsPerMinute"
        />
        <FormField
          render={({ field }) => (
            <Input
              type="number"
              {...field}
              fullWidth
              label="Max Tokens Per Minute"
              placeholder="Enter max tokens per minute"
            />
          )}
          name="maxTokensPerMinute"
        />
      </Dialog>
    </FormProvider>
  );
}

function OrganizationLevelRateLimitTable() {
  const organization = useCurrentAdminOrganization();

  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const [debouncedSearch] = useDebouncedValue(search, 500);

  const { data, isLoading } =
    webApi.admin.organizations.adminGetOrganizationRateLimits.useQuery({
      queryKey:
        webApiQueryKeys.admin.organizations.adminGetOrganizationRateLimitsWithSearch(
          organization?.id || '',
          {
            search: debouncedSearch,
            limit: 5,
            offset,
          },
        ),
      queryData: {
        params: {
          organizationId: organization?.id || '',
        },
        query: {
          search: debouncedSearch,
          limit: 5,
          offset,
        },
      },
      enabled: !!organization,
    });

  const { formatNumber } = useNumberFormatter();

  const columns: Array<ColumnDef<AdminOrganizationRateLimitItemType>> =
    useMemo(() => {
      return [
        {
          header: 'Model',
          accessorKey: 'modelName',
        },
        {
          header: 'Max Requests Per Minute',
          accessorKey: 'maxInferenceRequestsPerMinute',
          cell: ({ row }) =>
            formatNumber(row.original.maxInferenceRequestsPerMinute),
        },
        {
          header: 'Max Tokens Per Minute',
          accessorKey: 'maxInferenceTokensPerMinute',
          cell: ({ row }) =>
            formatNumber(row.original.maxInferenceTokensPerMinute),
        },
        {
          header: 'Actions',
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
              <UpdateOrganizationRateLimitDialog
                modelId={row.original.modelId}
                defaultValues={{
                  maxRequestsPerMinute:
                    row.original.maxInferenceRequestsPerMinute,
                  maxTokensPerMinute: row.original.maxInferenceTokensPerMinute,
                }}
              />
              <ResetOrganizationRateLimitDialog
                modelId={row.original.modelId}
              />
            </DropdownMenu>
          ),
        },
      ];
    }, [formatNumber]);

  return (
    <DashboardPageSection
      title="Organization Level Rate Limits"
      description="These are the rate limits for the organization as a whole. These rate limits will be applied to all models in the organization."
      actions={<CreateOrganizationRateLimitDialog />}
    >
      <DataTable
        columns={columns}
        data={data?.body.overrides || []}
        isLoading={isLoading}
        searchValue={search}
        onSearch={setSearch}
        offset={offset}
        onSetOffset={setOffset}
        limit={5}
      />
    </DashboardPageSection>
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
      },
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
                <Badge content="Banned" variant="destructive" />
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
      <OrganizationBillingSettings />
      <OrganizationLevelRateLimitTable />
      <VerifiedDomains />
      <CreditSection />
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

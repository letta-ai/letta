'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  FormField,
  FormProvider,
  isMultiValue,
  Select,
  TrashIcon,
  Typography,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InviteRuleType } from '@letta-cloud/sdk-web';
import { webApi, webApiContracts, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { z } from 'zod';
import { useCallback, useMemo, useState } from 'react';
import {
  RoleSelect,
  useGetLabelForRole,
} from '$web/client/components/RoleSelect/RoleSelect';
import type { ColumnDef } from '@tanstack/react-table';
import type { ServerInferResponses } from '@ts-rest/core';
import { useQueryClient } from '@tanstack/react-query';
import { UserPresetRoles } from '@letta-cloud/service-rbac';

const InviteRuleSchema = z.object({
  domain: z.object({
    value: z.string(),
    label: z.string(),
  }),
  role: z.object({
    value: UserPresetRoles,
    label: z.string(),
  }),
});

type InviteRuleFormValues = z.infer<typeof InviteRuleSchema>;

function AddInviteRuleDialog() {
  const t = useTranslations('organization/members/invite-rules');
  const { data: domains, isLoading: isLoadingDomains } =
    webApi.organizations.listVerifiedDomains.useQuery({
      queryKey: webApiQueryKeys.organizations.listVerifiedDomains,
    });

  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);

  const { mutate, isPending, error } =
    webApi.organizations.createInviteRule.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          | ServerInferResponses<
              typeof webApiContracts.organizations.listInviteRules,
              200
            >
          | undefined
        >(
          {
            queryKey: webApiQueryKeys.organizations.listInviteRules,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: {
                ...oldData.body,
                rules: [...oldData.body.rules, response.body],
              },
            };
          },
        );

        setOpen(false);
      },
    });

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      domainNotFound: t('AddInviteRuleDialog.errors.domainNotFound'),
      ruleAlreadyExists: t('AddInviteRuleDialog.errors.ruleAlreadyExists'),
      default: t('AddInviteRuleDialog.errors.default'),
    },
    contract: webApiContracts.organizations.createInviteRule,
  });

  const handleCreateInviteRule = useCallback(
    (values: InviteRuleFormValues) => {
      mutate({
        body: {
          domainId: values.domain.value,
          role: values.role.value,
        },
      });
    },
    [mutate],
  );

  const getLabelForRole = useGetLabelForRole();

  const form = useForm<InviteRuleFormValues>({
    resolver: zodResolver(InviteRuleSchema),
    defaultValues: {
      role: {
        label: getLabelForRole('editor'),
        value: 'editor',
      },
    },
  });

  const options = useMemo(() => {
    if (!domains) {
      return [];
    }

    return domains.body.domains.map((domain) => ({
      label: domain.domain,
      value: domain.id,
    }));
  }, [domains]);

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={open}
        isConfirmBusy={isPending}
        onOpenChange={setOpen}
        trigger={<Button label={t('AddInviteRuleDialog.trigger')} />}
        onSubmit={form.handleSubmit(handleCreateInviteRule)}
        errorMessage={errorTranslation?.message}
        title={t('AddInviteRuleDialog.title')}
      >
        <FormField
          name="domain"
          render={({ field }) => (
            <Select
              labelVariant="simple"
              label={t('AddInviteRuleDialog.domain.label')}
              placeholder={t('AddInviteRuleDialog.domain.placeholder')}
              value={field.value}
              isLoading={isLoadingDomains}
              options={options}
              description={t('AddInviteRuleDialog.domain.description')}
              fullWidth
              onSelect={(val) => {
                if (isMultiValue(val)) {
                  return;
                }

                field.onChange(val);
              }}
            />
          )}
        />
        <FormField
          name="role"
          render={({ field }) => (
            <RoleSelect
              label={t('AddInviteRuleDialog.role.label')}
              placeholder={t('AddInviteRuleDialog.role.placeholder')}
              value={field.value}
              fullWidth
              onSelect={(val) => {
                if (isMultiValue(val)) {
                  return;
                }

                field.onChange(val);
              }}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

interface DeleteInviteRuleDialogProps {
  ruleId: string;
}

function DeleteInviteRuleDialog(props: DeleteInviteRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const { ruleId } = props;

  const t = useTranslations('organization/members/invite-rules');
  const queryClient = useQueryClient();

  const { mutate, isPending, isError } =
    webApi.organizations.deleteInviteRule.useMutation({
      onSuccess: () => {
        queryClient.setQueriesData<
          | ServerInferResponses<
              typeof webApiContracts.organizations.listInviteRules,
              200
            >
          | undefined
        >(
          {
            queryKey: webApiQueryKeys.organizations.listInviteRules,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            return {
              ...oldData,
              body: {
                ...oldData.body,
                rules: oldData.body.rules.filter((rule) => rule.id !== ruleId),
              },
            };
          },
        );

        setOpen(false);
      },
    });

  return (
    <Dialog
      isOpen={open}
      isConfirmBusy={isPending}
      onOpenChange={setOpen}
      trigger={
        <Button
          hideLabel
          preIcon={<TrashIcon />}
          color="tertiary"
          label={t('DeleteInviteRuleDialog.trigger')}
        />
      }
      onConfirm={() => {
        mutate({
          params: {
            ruleId,
          },
        });
      }}
      errorMessage={isError ? t('DeleteInviteRuleDialog.error') : undefined}
      title={t('DeleteInviteRuleDialog.title')}
    >
      {t('DeleteInviteRuleDialog.description')}
    </Dialog>
  );
}

function InviteRules() {
  const t = useTranslations('organization/members/invite-rules');
  const { data: inviteRules } = webApi.organizations.listInviteRules.useQuery({
    queryKey: webApiQueryKeys.organizations.listInviteRules,
  });

  const columns: Array<ColumnDef<InviteRuleType>> = useMemo(() => {
    return [
      {
        header: t('columns.rule'),
        accessorKey: 'domain',
        cell: ({ row }) => (
          <Typography variant="body2">
            {t.rich('columns.ruleSentence', {
              bold: (chunks) => {
                return (
                  <Typography overrideEl="span" variant="body2" inline bold>
                    {chunks}
                  </Typography>
                );
              },
              domain: row.original.domain,
              role: row.original.role,
            })}
          </Typography>
        ),
      },
      {
        header: t('columns.actions'),
        accessor: 'actions',
        meta: {
          style: {
            columnAlign: 'right',
          },
        },
        cell: ({ row }) => {
          return <DeleteInviteRuleDialog ruleId={row.original.id} />;
        },
      },
    ];
  }, [t]);

  return (
    <DashboardPageLayout
      title={t('title')}
      encapsulatedFullHeight
      actions={<AddInviteRuleDialog />}
    >
      <DashboardPageSection fullHeight>
        <DataTable
          columns={columns}
          data={inviteRules?.body.rules || []}
          autofitHeight
          isLoading={!inviteRules}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default InviteRules;

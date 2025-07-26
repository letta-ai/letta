import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import type { Source } from '@letta-cloud/sdk-core';
import { isAPIError } from '@letta-cloud/sdk-core';
import {
  Button,
  VerticalDotsIcon,
  TrashIcon,
  EditIcon,
  DropdownMenu,
  DropdownMenuItem,
  Dialog,
  Typography,
  FormField,
  FormProvider,
  RawInput,
  useForm,
  LinkOffIcon,
} from '@letta-cloud/ui-component-library';
import {
  type AgentState,
  useAgentsServiceDetachSourceFromAgent,
  useSourcesServiceModifySource,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCurrentAgent } from '../../../../hooks';
import { DeleteDataSourceDialog } from '../DeleteDatasourceDialog/DeleteDatasourceDialog';

// Rename Modal as a child component
const renameDataSourceSchema = z.object({
  name: z.string().min(1),
});

type RenameDataSourceFormValues = z.infer<typeof renameDataSourceSchema>;

function RenameDataSourceDialog({ source }: { source: Source }) {
  const t = useTranslations('ADE/EditDataSourcesPanel.RenameDataSourceModal');
  const queryClient = useQueryClient();
  const { id: agentId } = useCurrentAgent();
  const [isOpen, setIsOpen] = React.useState(false);

  const form = useForm<RenameDataSourceFormValues>({
    resolver: zodResolver(renameDataSourceSchema),
    defaultValues: {
      name: source.name,
    },
  });

  const { mutate, isPending, error, reset } = useSourcesServiceModifySource({
    onSuccess: (response) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            sources: oldData.sources.map((currentSource) => {
              if (currentSource.id === source.id) {
                return {
                  ...currentSource,
                  name: response.name,
                };
              }

              return currentSource;
            }),
          };
        },
      );

      form.reset();
      setIsOpen(false);
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        form.reset();
        reset();
      }
    },
    [form, reset, setIsOpen],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.status === 409) {
          return t('errors.conflict');
        }
      }

      return t('errors.default');
    }

    return undefined;
  }, [error, t]);

  const handleSubmit = useCallback(
    (values: RenameDataSourceFormValues) => {
      mutate({
        sourceId: source.id || '',
        requestBody: {
          name: values.name.trim(),
        },
      });
    },
    [mutate, source.id],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        errorMessage={errorMessage}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('title')}
        confirmText={t('confirm')}
        isConfirmBusy={isPending}
        testId="rename-data-source-dialog"
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            preIcon={<EditIcon />}
            label={t('trigger')}
          />
        }
      >
        <FormField
          render={({ field }) => (
            <RawInput
              fullWidth
              {...field}
              hideLabel
              size="small"
              label={t('name.label')}
              placeholder={t('name.placeholder')}
              data-testid="rename-data-source-input"
            />
          )}
          name="name"
        />
      </Dialog>
    </FormProvider>
  );
}

// Detach Modal as a child component
function DetachDataSourceDialog({ source }: { source: Source }) {
  const { id: agentId } = useCurrentAgent();
  const t = useTranslations('ADE/EditDataSourcesPanel.DetachDataSourceModal');
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const {
    mutate: detachSource,
    isError,
    isPending,
  } = useAgentsServiceDetachSourceFromAgent({
    onSuccess: (_, variables: { agentId: string; sourceId: string }) => {
      queryClient.setQueriesData<AgentState | undefined>(
        {
          queryKey: UseAgentsServiceRetrieveAgentKeyFn({
            agentId,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            sources: oldData.sources.filter(
              (currentSource) => currentSource.id !== variables.sourceId,
            ),
          };
        },
      );

      setIsOpen(false);
    },
  });

  const handleDetach = useCallback(() => {
    detachSource({
      agentId,
      sourceId: source.id || '',
    });
  }, [agentId, detachSource, source.id]);

  return (
    <Dialog
      onOpenChange={setIsOpen}
      isOpen={isOpen}
      testId="detach-data-source-dialog"
      title={t('title', { sourceName: source.name })}
      confirmText={t('confirm')}
      isConfirmBusy={isPending}
      onConfirm={handleDetach}
      errorMessage={isError ? t('error') : undefined}
      trigger={
        <DropdownMenuItem
          data-testid="detach-data-source-dialog-trigger"
          doNotCloseOnSelect
          preIcon={<LinkOffIcon />}
          label={t('trigger')}
        />
      }
    >
      <Typography>{t('areYouSure', { sourceName: source.name })}</Typography>
    </Dialog>
  );
}

export interface DatasourceDropdownMenuProps {
  source: Source;
  trigger?: React.ReactNode;
}

export function DatasourceDropdownMenu(props: DatasourceDropdownMenuProps) {
  const { source, trigger } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel.DatasourceDropdownMenu');

  return (
    <DropdownMenu
      triggerAsChild
      className="bg-background-grey"
      align="start"
      trigger={
        trigger || (
          <Button
            data-testid="datasource-dropdown-menu"
            color="tertiary"
            size="xsmall"
            hideLabel
            label={t('menuLabel')}
            preIcon={<VerticalDotsIcon />}
          />
        )
      }
    >
      <RenameDataSourceDialog source={source} />
      <DetachDataSourceDialog source={source} />
      <DeleteDataSourceDialog
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            preIcon={<TrashIcon />}
            label={t('delete')}
          />
        }
        source={source}
      />
    </DropdownMenu>
  );
}

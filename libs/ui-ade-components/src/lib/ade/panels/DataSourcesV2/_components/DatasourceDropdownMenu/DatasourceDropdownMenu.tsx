import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback } from 'react';
import type { Source } from '@letta-cloud/sdk-core';
import {
  Button,
  VerticalDotsIcon,
  TrashIcon,
  EditIcon,
  DropdownMenu,
  DropdownMenuItem,
  Dialog,
  Typography,
  LinkOffIcon,
} from '@letta-cloud/ui-component-library';
import {
  type AgentState,
  useAgentsServiceDetachSourceFromAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../../../../../hooks';
import { DeleteDataSourceDialog } from '../DeleteDatasourceDialog/DeleteDatasourceDialog';
import { RenameDataSourceDialog } from '../RenameDataSourceDialog/RenameDataSourceDialog';

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
  disabled?: boolean;
}

export function DatasourceDropdownMenu(props: DatasourceDropdownMenuProps) {
  const { source, trigger, disabled = false } = props;
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
            disabled={disabled}
            label={t('menuLabel')}
            preIcon={<VerticalDotsIcon />}
          />
        )
      }
    >
      <RenameDataSourceDialog
        source={source}
        trigger={
          <DropdownMenuItem
            doNotCloseOnSelect
            preIcon={<EditIcon />}
            label={t('rename')}
          />
        }
      />
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

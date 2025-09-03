'use client';
import { useTranslations } from '@letta-cloud/translations';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import {
  type Tool,
  useToolsServiceDeleteTool,
  UseToolsServiceListToolsKeyFn,
} from '@letta-cloud/sdk-core';
import { Button, Dialog } from '@letta-cloud/ui-component-library';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';
import { MY_TOOLS_PAYLOAD } from '../../routes/MyTools/MyTools';

interface DeleteToolButtonProps {
  currentToolId: string;
}

export function DeleteToolButton(props: DeleteToolButtonProps) {
  const { currentToolId } = props;
  const t = useTranslations('ADE/Tools');
  const queryClient = useQueryClient();

  const [isOpened, setIsOpened] = useState(false);
  const { setSelectedToolId } = useToolManagerState();

  const {
    mutate: deleteTool,
    isError,
    isPending,
  } = useToolsServiceDeleteTool({
    onSuccess: () => {
      queryClient.setQueriesData<Tool[]>(
        {
          queryKey: UseToolsServiceListToolsKeyFn(MY_TOOLS_PAYLOAD),
          exact: false,
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return oldData.filter((tool) => tool.id !== currentToolId);
        },
      );

      setIsOpened(false);
      setSelectedToolId(null);
    },
  });

  const handleDelete = useCallback(() => {
    deleteTool({
      toolId: currentToolId,
    });
  }, [currentToolId, deleteTool]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      isOpen={isOpened}
      confirmColor="destructive"
      onOpenChange={setIsOpened}
      errorMessage={isError ? t('DeleteToolButton.error') : undefined}
      title={t('DeleteToolButton.title')}
      confirmText={t('DeleteToolButton.confirm')}
      onConfirm={handleDelete}
      trigger={
        <Button color="destructive" label={t('DeleteToolButton.trigger')} />
      }
    >
      {t('DeleteToolButton.description')}
    </Dialog>
  );
}

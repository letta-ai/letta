'use client';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  Typography,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAgentsServiceDeleteAgent } from '@letta-cloud/sdk-core';
import { useAgentBaseTypeName } from '../hooks/useAgentBaseNameType/useAgentBaseNameType';

interface DeleteAgentDialogProps {
  onSuccess: VoidFunction;
  trigger: React.ReactNode;
  agentId: string;
  agentName: string;
}

export function DeleteAgentDialog(props: DeleteAgentDialogProps) {
  const { onSuccess, trigger, agentName: name, agentId } = props;
  const [isOpen, setIsOpen] = useState(false);

  const t = useTranslations('DeleteAgentDialog');

  const DeleteAgentDialogFormSchema = useMemo(
    () =>
      z.object({
        agentName: z.literal(name, {
          message: t('nameError'),
        }),
      }),
    [name, t],
  );

  const form = useForm<z.infer<typeof DeleteAgentDialogFormSchema>>({
    resolver: zodResolver(DeleteAgentDialogFormSchema),
    defaultValues: {
      agentName: '',
    },
  });

  const { mutate, isPending, isSuccess, isError } = useAgentsServiceDeleteAgent(
    {
      onSuccess,
    },
  );

  const agentBaseType = useAgentBaseTypeName();

  const handleSubmit = useCallback(() => {
    mutate({
      agentId,
    });
  }, [mutate, agentId]);

  return (
    <FormProvider {...form}>
      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        trigger={trigger}
        errorMessage={
          isError
            ? t('error', {
                agentBaseType: agentBaseType.base,
              })
            : undefined
        }
        confirmColor="destructive"
        confirmText={t('confirm', {
          agentBaseType: agentBaseType.capitalized,
        })}
        title={t('title', {
          agentBaseType: agentBaseType.capitalized,
        })}
        onSubmit={form.handleSubmit(handleSubmit)}
        isConfirmBusy={isPending || isSuccess}
      >
        <Typography>
          {t('description', {
            agentBaseType: agentBaseType.base,
          })}
        </Typography>
        <Typography>
          {t.rich('confirmText', {
            templateName: name,
            agentBaseType: agentBaseType.base,
            strong: (chunks) => (
              <Typography overrideEl="span" bold>
                {chunks}
              </Typography>
            ),
          })}
        </Typography>
        <FormField
          name="agentName"
          render={({ field }) => (
            <Input
              fullWidth
              placeholder={name}
              label={t('confirmTextLabel', {
                agentBaseType: agentBaseType.capitalized,
              })}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

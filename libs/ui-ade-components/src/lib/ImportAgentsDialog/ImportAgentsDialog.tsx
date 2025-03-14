'use client';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  UseAgentsServiceListAgentsKeyFn,
  useAgentsServiceImportAgentSerialized,
} from '@letta-cloud/sdk-core';
import {
  Dialog,
  FormField,
  FormProvider,
  LettaInvaderIcon,
  SingleFileUpload,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';

interface ImportAgentsDialogProps {
  trigger: React.ReactNode;
}

export function ImportAgentsDialog(props: ImportAgentsDialogProps) {
  const { trigger } = props;
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const queryClient = useQueryClient();
  const t = useTranslations('ImportAgentsDialog');

  const UploadToFormValuesSchema = useMemo(
    () =>
      z.object({
        file: z.custom<File>((v) => v instanceof File, {
          message: t('errors.fileIsRequired'),
        }),
      }),
    [t],
  );

  type UploadToFormValues = z.infer<typeof UploadToFormValuesSchema>;

  const { mutate, isPending, isSuccess, reset } =
    useAgentsServiceImportAgentSerialized({
      onSuccess: async () => {
        await queryClient.refetchQueries({
          queryKey: ['infinite', ...UseAgentsServiceListAgentsKeyFn()].slice(
            0,
            -1,
          ),
          exact: false,
        });

        handleDialogOpenChange(false);
      },
    });

  const form = useForm<UploadToFormValues>({
    resolver: zodResolver(UploadToFormValuesSchema),
    mode: 'onChange',
  });

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        form.reset();
        reset();
      }

      setIsDialogOpen(nextOpen);
    },
    [form, reset],
  );

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);

  const onSubmit = useCallback(
    (values: UploadToFormValues) => {
      mutate({
        formData: { file: values.file },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={handleDialogOpenChange}
        isOpen={isDialogOpen}
        onSubmit={form.handleSubmit(onSubmit)}
        title={t('title')}
        confirmText={t('confirm')}
        isConfirmBusy={isPending || isSuccess}
        trigger={trigger}
      >
        <FormField
          render={({ field }) => (
            <SingleFileUpload
              fullWidth
              {...field}
              hideLabel
              changeFileText={t('changeAgent')}
              removeFileText={t('removeAgent')}
              accept=".af,application/json"
              fileIcon={<LettaInvaderIcon />}
              chooseFileText={t('chooseAgent')}
              dropText={t('dropAgent')}
              label={t('label')}
            />
          )}
          name="file"
        />
      </Dialog>
    </FormProvider>
  );
}

import { useTranslations } from '@letta-cloud/translations';
import {
  Checkbox,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  useForm,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ListProvidersResponse, Provider } from '@letta-cloud/sdk-core';
import {
  useProvidersServiceDeleteProvider,
  UseProvidersServiceListProvidersKeyFn,
} from '@letta-cloud/sdk-core';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getUseProvidersServiceModelsStandardArgs } from '../utils/getUseProvidersServiceModelsStandardArgs/getUseProvidersServiceModelsStandardArgs';

interface DeleteProviderModalProps {
  trigger: React.ReactNode;
  provider: Provider;
  onSuccess?: () => void;
}

export function DeleteProviderModal(props: DeleteProviderModalProps) {
  const { trigger, provider, onSuccess } = props;

  const [open, setOpen] = useState(false);
  const t = useTranslations('pages/models/DeleteProviderModal');

  const queryClient = useQueryClient();

  const DeleteProviderModalSchema = z.object({
    confirm: z.boolean().refine((val) => val === true, {
      message: t('errors.notConfirmed'),
    }),
  });

  const form = useForm({
    resolver: zodResolver(DeleteProviderModalSchema),
    defaultValues: {
      confirm: false,
    },
  });

  const { isError, mutate, isPending } = useProvidersServiceDeleteProvider({
    onSuccess: () => {
      queryClient.setQueriesData<ListProvidersResponse | undefined>(
        {
          queryKey: UseProvidersServiceListProvidersKeyFn(
            getUseProvidersServiceModelsStandardArgs(),
          ),
        },
        (oldData) => {
          if (oldData) {
            return oldData.filter((p) => p.id !== provider.id);
          }

          return [];
        },
      );

      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpen(open);
      if (!open) {
        form.reset();
      }
    },
    [form],
  );

  const handleDelete = useCallback(() => {
    if (!provider.id) {
      return;
    }

    mutate({
      providerId: provider.id,
    });
  }, [mutate, provider.id]);

  return (
    <FormProvider {...form}>
      <Dialog
        onOpenChange={handleOpenChange}
        isOpen={open}
        isConfirmBusy={isPending}
        trigger={trigger}
        errorMessage={isError ? t('errors.default') : undefined}
        title={t('title')}
        onSubmit={form.handleSubmit(handleDelete)}
      >
        {t('description')}
        <HStack fullWidth border padding="small">
          <FormField
            name="confirm"
            render={({ field }) => (
              <Checkbox
                label={t('confirmDelete')}
                fullWidth
                onCheckedChange={field.onChange}
                checked={field.value}
              />
            )}
          />
        </HStack>
      </Dialog>
    </FormProvider>
  );
}

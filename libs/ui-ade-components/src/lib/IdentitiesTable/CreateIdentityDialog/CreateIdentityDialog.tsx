import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  isAPIError,
  type ListIdentitiesResponse,
  useIdentitiesServiceCreateIdentity,
} from '@letta-cloud/sdk-core';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  isMultiValue,
  Select,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InfiniteData } from '@tanstack/query-core';
import { UseInfiniteIdentitiesQueryFn } from '../constants';
import { useIdentityOptions } from '../hooks/useIdentityOptions/useIdentityOptions';

interface CreateIdentityDialogProps {
  trigger: React.ReactNode;
  currentProjectId?: string;
}

const identityFormSchema = z.object({
  uniqueIdentifier: z.string(),
  identityType: z.enum(['org', 'user', 'other']),
  name: z.string(),
});

type IdentityFormValues = z.infer<typeof identityFormSchema>;

export function CreateIdentityDialog(props: CreateIdentityDialogProps) {
  const { trigger, currentProjectId } = props;
  const [open, setOpen] = React.useState(false);

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    defaultValues: {
      uniqueIdentifier: '',
      identityType: 'user',
      name: '',
    },
  });
  const queryClient = useQueryClient();
  const { mutate, isPending, error, reset } =
    useIdentitiesServiceCreateIdentity();

  const t = useTranslations('CreateIdentityDialog');

  const handleOpenChange = useCallback(
    (nextState: boolean) => {
      setOpen(nextState);
      if (!nextState) {
        form.reset();
        reset();
      }
    },
    [form, reset],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.body?.detail?.includes('unique constraint')) {
          return t('errors.uniqueConstraint');
        }
      }

      return t('errors.default');
    }

    return '';
  }, [error, t]);

  const handleSubmit = useCallback(
    (values: IdentityFormValues) => {
      mutate(
        {
          requestBody: {
            identifier_key: values.uniqueIdentifier.trim(),
            identity_type: values.identityType,
            name: values.name.trim(),
            project_id: currentProjectId,
          },
        },
        {
          onSuccess: (response) => {
            handleOpenChange(false);

            queryClient.setQueriesData<
              InfiniteData<ListIdentitiesResponse> | undefined
            >(
              {
                queryKey: UseInfiniteIdentitiesQueryFn([]).slice(0, 1),
                exact: false,
              },
              (data) => {
                if (!data) {
                  return data;
                }

                return {
                  ...data,
                  pages: [
                    [response, ...data.pages[0]],
                    ...data.pages.slice(1, data.pages.length),
                  ],
                };
              },
            );
          },
        },
      );
    },
    [mutate, queryClient, currentProjectId, handleOpenChange],
  );
  const { identityTypeOptions, getOptionFromValue } = useIdentityOptions();

  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('title')}
        errorMessage={errorMessage}
        isConfirmBusy={isPending}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        isOpen={open}
      >
        <VStack gap="form">
          <FormField
            name="name"
            render={({ field }) => (
              <Input fullWidth {...field} label={t('name.label')} />
            )}
          />

          <FormField
            name="identityType"
            render={({ field }) => (
              <Select
                fullWidth
                onSelect={(value) => {
                  if (isMultiValue(value) || !value) {
                    return;
                  }

                  field.onChange(value?.value);
                }}
                value={getOptionFromValue(field.value)}
                label={t('identityType.label')}
                options={identityTypeOptions}
              />
            )}
          />
          <FormField
            name="uniqueIdentifier"
            render={({ field }) => (
              <Input
                {...field}
                fullWidth
                label={t('uniqueIdentifier.label')}
                description={t('uniqueIdentifier.description')}
              />
            )}
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback, useMemo } from 'react';
import {
  type ListIdentitiesResponse,
  useIdentitiesServiceCreateIdentity,
} from '@letta-cloud/letta-agents-api';
import {
  Dialog,
  FormField,
  FormProvider,
  Input,
  isMultiValue,
  Select,
  useForm,
  VStack,
} from '@letta-cloud/component-library';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InfiniteData } from '@tanstack/query-core';
import { UseInfiniteIdentitiesQueryFn } from '../constants';
import { useIdentityTypeToTranslationMap } from '../hooks/useIdentityTypeToTranslationMap';

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
  const { mutate, isPending, reset } = useIdentitiesServiceCreateIdentity();

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

  const handleSubmit = useCallback(
    (values: IdentityFormValues) => {
      mutate(
        {
          requestBody: {
            identifier_key: values.uniqueIdentifier,
            identity_type: values.identityType,
            name: values.name,
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
  const identityTypeToTranslationMap = useIdentityTypeToTranslationMap();

  const identityTypeOptions = useMemo(() => {
    return [
      { label: identityTypeToTranslationMap.org, value: 'org' },
      { label: identityTypeToTranslationMap.user, value: 'user' },
      { label: identityTypeToTranslationMap.other, value: 'other' },
    ];
  }, [identityTypeToTranslationMap]);

  const getOptionFromValue = useCallback(
    (value: string) => {
      return identityTypeOptions.find((option) => option.value === value);
    },
    [identityTypeOptions],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleSubmit)}
        title={t('title')}
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

'use client';
import { CenteredPageCard } from '$letta/client/components';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  Alert,
  Button,
  Form,
  FormActions,
  FormField,
  FormProvider,
  Input,
  useForm,
  VStack,
} from '@letta-web/component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { webApi } from '$letta/client';
import { useCallback } from 'react';

const createOrganizationFormSchema = z.object({
  name: z.string(),
});

type CreateOrganizationForm = z.infer<typeof createOrganizationFormSchema>;

function CreateOrganizationPage() {
  const t = useTranslations('create-organization');

  const form = useForm<CreateOrganizationForm>({
    resolver: zodResolver(createOrganizationFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const { mutate, isPending, isError } =
    webApi.organizations.createOrganization.useMutation({
      onSuccess: () => {
        window.location.href = '/';
      },
    });

  const handleCreateOrganization = useCallback(
    (values: CreateOrganizationForm) => {
      mutate({
        body: values,
      });
    },
    [mutate]
  );

  return (
    <CenteredPageCard title={t('title')}>
      {isError && <Alert title={t('error')} variant="destructive" />}
      <VStack padding>
        <FormProvider {...form}>
          <Form onSubmit={form.handleSubmit(handleCreateOrganization)}>
            <VStack fullWidth>
              <FormField
                name="name"
                render={({ field }) => {
                  return (
                    <Input
                      fullWidth
                      label={t('name.label')}
                      placeholder={t('name.placeholder')}
                      {...field}
                    />
                  );
                }}
              />
              <FormActions>
                <Button type="submit" label={t('submit')} busy={isPending} />
              </FormActions>
            </VStack>
          </Form>
        </FormProvider>
      </VStack>
    </CenteredPageCard>
  );
}

export default CreateOrganizationPage;

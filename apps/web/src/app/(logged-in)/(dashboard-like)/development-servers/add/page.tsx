'use client';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  Alert,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  Form,
  FormActions,
  FormField,
  FormProvider,
  InlineCode,
  Input,
  PlusIcon,
  Typography,
  useForm,
} from '@letta-web/component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import { webApi } from '$web/client';

const addRemoteDevelopmentServerFormSchema = z.object({
  name: z.string().min(3).max(50),
  url: z.string().url(),
  password: z.string(),
});

type AddRemoteDevelopmentServerFormValues = z.infer<
  typeof addRemoteDevelopmentServerFormSchema
>;

function AddRemoteDevelopmentServer() {
  const t = useTranslations('development-servers/add');

  const form = useForm<AddRemoteDevelopmentServerFormValues>({
    resolver: zodResolver(addRemoteDevelopmentServerFormSchema),
    defaultValues: {
      name: '',
      url: '',
      password: '',
    },
  });

  const { mutate, isPending, isSuccess, isError } =
    webApi.developmentServers.createDevelopmentServer.useMutation();

  const handleSubmit = useCallback(
    (values: AddRemoteDevelopmentServerFormValues) => {
      if (isPending || isSuccess) {
        return;
      }

      mutate(
        {
          body: {
            name: values.name,
            url: values.url,
            password: values.password,
          },
        },
        {
          onSuccess: (response) => {
            window.location.href = `/development-servers/${response.body.developmentServer.id}/agents`;
          },
        }
      );
    },
    [isPending, isSuccess, mutate]
  );

  return (
    <DashboardPageLayout>
      <DashboardPageSection title={t('title')}>
        <FormProvider {...form}>
          <Form variant="contained" onSubmit={form.handleSubmit(handleSubmit)}>
            <Alert title="" variant="info">
              <Typography overrideEl="span">
                {t.rich('description', {
                  code: (chunks) => (
                    <InlineCode
                      code={chunks?.toString() || ''}
                      hideCopyButton
                    />
                  ),
                })}
              </Typography>
            </Alert>
            <FormField
              name="name"
              render={({ field }) => (
                <Input fullWidth label={t('name.label')} {...field} />
              )}
            />
            <FormField
              name="url"
              render={({ field }) => (
                <Input
                  fullWidth
                  description={t('url.description')}
                  label={t('url.label')}
                  {...field}
                />
              )}
            />
            <FormField
              name="password"
              render={({ field }) => (
                <Input
                  fullWidth
                  showVisibilityControls
                  description={t('password.description')}
                  label={t('password.label')}
                  {...field}
                />
              )}
            />
            <FormActions errorMessage={isError ? t('error') : ''}>
              <Button
                type="submit"
                preIcon={<PlusIcon />}
                busy={isPending || isSuccess}
                label={t('submit')}
              ></Button>
            </FormActions>
          </Form>
        </FormProvider>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default AddRemoteDevelopmentServer;

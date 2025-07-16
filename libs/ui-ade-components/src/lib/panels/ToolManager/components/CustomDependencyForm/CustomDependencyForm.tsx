import React from 'react';
import {
  HStack,
  VStack,
  Typography,
  Form,
  FormField,
  Input,
  FormProvider,
  Button,
  PlusIcon,
  useForm,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useManageDependencies } from '../DependencyViewer/useManageDependencies/useManageDependencies';

const dependencySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
});

type DependencyFormData = z.infer<typeof dependencySchema>;

export function CustomDependencyForm() {
  const t = useTranslations('DependencyViewer');
  const { addDependency } = useManageDependencies();

  const form = useForm<DependencyFormData>({
    resolver: zodResolver(dependencySchema),
    defaultValues: {
      name: '',
      version: '',
    },
  });

  const nameValue = form.watch('name');

  function handleSubmit(data: DependencyFormData) {
    const dependency = {
      name: data.name,
      version: data.version?.trim() || undefined,
    };
    addDependency(dependency);
    form.reset();
  }

  return (
    <VStack gap="small" padding="medium" borderBottom fullWidth>
      <Typography variant="body2" bold>
        {t('customDependency.title')}
      </Typography>
      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          <HStack align="end" gap="medium" fullWidth>
            <div className="flex-1">
              <FormField
                name="name"
                render={({ field }) => (
                  <Input
                    label={t('customDependency.nameLabel')}
                    hideLabel
                    size="small"
                    fullWidth
                    placeholder={t('customDependency.namePlaceholder')}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="flex-1">
              <FormField
                name="version"
                render={({ field }) => (
                  <Input
                    label={t('customDependency.versionLabel')}
                    hideLabel
                    size="small"
                    fullWidth
                    placeholder={t('customDependency.versionPlaceholder')}
                    {...field}
                  />
                )}
              />
            </div>

            <Button
              type="submit"
              preIcon={<PlusIcon />}
              label={t('customDependency.addButton')}
              size="small"
              color="secondary"
              bold
              disabled={!nameValue?.trim()}
            />
          </HStack>
        </Form>
      </FormProvider>
    </VStack>
  );
}

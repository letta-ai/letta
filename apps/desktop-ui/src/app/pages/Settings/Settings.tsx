import {
  Button,
  ChipSelect,
  CogIcon,
  DatabaseIcon,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  Input,
  Section,
  toast,
  Typography,
  useForm,
  DesktopPageLayout,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useDesktopConfig } from '../../hooks/useDesktopConfig/useDesktopConfig';
import { z } from 'zod';
import { useCallback, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

const POSTGRESCONNECTION_STRING_REGEX =
  /^postgres(?:ql)?:\/\/(?:[^:]+:[^@]+@)?[^:]+:\d+\/[^?]+(?:\?.+)?$/;

const EditDatabaseSettingsConfigSchema = z.object({
  type: z.enum(['embedded', 'external']),
  connectionString: z.string().optional(),
});

type EditDatabaseSettingsPayload = z.infer<
  typeof EditDatabaseSettingsConfigSchema
>;

interface EditDatabaseSettingsDialogProps {
  defaultValues: EditDatabaseSettingsPayload;
}

function EditDatabaseSettingsDialog(props: EditDatabaseSettingsDialogProps) {
  const t = useTranslations('Settings');
  const { defaultValues } = props;
  const [isOpen, setIsOpen] = useState(false);
  const { handleSetDesktopConfig } = useDesktopConfig();

  const ResolverSchema = useMemo(() => {
    return EditDatabaseSettingsConfigSchema.superRefine((data, ctx) => {
      if (data.type === 'external') {
        if (!data.connectionString) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t(
              'EditDatabaseSettingsDialog.connectionString.error.missing',
            ),
            path: ['connectionString'],
          });
          return false;
        }

        if (!POSTGRESCONNECTION_STRING_REGEX.exec(data.connectionString)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t(
              'EditDatabaseSettingsDialog.connectionString.error.invalid',
            ),
            path: ['connectionString'],
          });

          return false;
        }
      }

      return true;
    });
  }, [t]);

  const form = useForm<EditDatabaseSettingsPayload>({
    resolver: zodResolver(ResolverSchema),
    defaultValues: defaultValues,
  });

  const options = useMemo(() => {
    return [
      {
        label: t('DatabaseSettings.types.embedded'),
        value: 'embedded',
      },
      {
        label: t('DatabaseSettings.types.external'),
        value: 'external',
      },
    ];
  }, [t]);

  const type = form.watch('type');

  const handleSubmit = useCallback((values: EditDatabaseSettingsPayload) => {
    setIsOpen(false);

    if (values.type === 'embedded') {
      void handleSetDesktopConfig({
        version: '1',
        databaseConfig: {
          type: values.type,
          embeddedType: 'pgserver',
        },
      });
      return;
    }

    if (!values.connectionString) {
      toast.error(t('EditDatabaseSettingsDialog.connectionString.missing'));
      return;
    }

    void handleSetDesktopConfig({
      version: '1',
      databaseConfig: {
        type: values.type,
        connectionString: values.connectionString,
      },
    });
  }, []);
  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleSubmit)}
        isOpen={isOpen}
        title={t('EditDatabaseSettingsDialog.title')}
        onOpenChange={setIsOpen}
        trigger={
          <Button
            color="secondary"
            size="small"
            label={t('DatabaseSettings.edit')}
          />
        }
      >
        <FormField
          name="type"
          render={({ field }) => {
            const selectedOption = options.find(
              (option) => option.value === field.value,
            );

            return (
              <ChipSelect
                labelVariant="simple"
                label={t('DatabaseSettings.type')}
                isMultiSelect={false}
                onChange={(value) => {
                  field.onChange(value[0].value);
                }}
                value={selectedOption ? [selectedOption] : []}
                options={[
                  {
                    label: t('DatabaseSettings.types.embedded'),
                    value: 'embedded',
                  },
                  {
                    label: t('DatabaseSettings.types.external'),
                    value: 'external',
                  },
                ]}
              />
            );
          }}
        />
        <FormField
          name="connectionString"
          render={({ field }) => {
            return (
              <Input
                disabled={type !== 'external'}
                labelVariant="simple"
                fullWidth
                label={t('EditDatabaseSettingsDialog.connectionString.label')}
                {...field}
                value={type === 'external' ? field.value : ''}
                description={
                  type !== 'external'
                    ? t(
                        'EditDatabaseSettingsDialog.connectionString.descriptionNone',
                      )
                    : t(
                        'EditDatabaseSettingsDialog.connectionString.description',
                      )
                }
                placeholder={
                  type !== 'external'
                    ? t(
                        'EditDatabaseSettingsDialog.connectionString.placeholderNone',
                      )
                    : t(
                        'EditDatabaseSettingsDialog.connectionString.placeholder',
                      )
                }
              />
            );
          }}
        />
      </Dialog>
    </FormProvider>
  );
}

function DatabaseSettings() {
  const t = useTranslations('Settings');
  const { desktopConfig } = useDesktopConfig();

  return (
    <HStack border color="background-grey" padding="medium" gap="xlarge">
      <Section
        icon={<DatabaseIcon />}
        title={t('DatabaseSettings.title')}
        actions={
          desktopConfig && (
            <EditDatabaseSettingsDialog
              defaultValues={{
                type: desktopConfig.databaseConfig.type,
                connectionString:
                  desktopConfig.databaseConfig.type === 'external'
                    ? desktopConfig.databaseConfig.connectionString
                    : '',
              }}
            />
          )
        }
      >
        <HStack gap="xlarge">
          <VStack>
            <Typography bold variant="body3">
              {t('DatabaseSettings.type')}
            </Typography>
            <HStack>
              <Typography variant="body3">
                {desktopConfig?.databaseConfig.type === 'external'
                  ? t('DatabaseSettings.types.external')
                  : t('DatabaseSettings.types.embedded')}
              </Typography>
            </HStack>
          </VStack>
          {desktopConfig?.databaseConfig.type === 'external' && (
            <VStack>
              <Typography bold variant="body3">
                {t('DatabaseSettings.connectionString')}
              </Typography>
              <HStack>
                <Typography variant="body3">
                  {desktopConfig?.databaseConfig.connectionString}
                </Typography>
              </HStack>
            </VStack>
          )}
        </HStack>
      </Section>
    </HStack>
  );
}

export function Settings() {
  const t = useTranslations('Settings');

  return (
    <DesktopPageLayout
      icon={<CogIcon />}
      subtitle={t('subtitle')}
      title={t('title')}
    >
      <VStack padding>
        <DatabaseSettings />
      </VStack>
    </DesktopPageLayout>
  );
}

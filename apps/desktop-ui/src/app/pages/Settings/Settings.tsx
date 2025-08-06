import {
  Alert,
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
import { TestConnectionButton } from './TestConnectionButton';

const POSTGRESCONNECTION_STRING_REGEX =
  /^postgres(?:ql)?:\/\/(?:[^:]+:[^@]+@)?[^:]+:\d+\/[^?]+(?:\?.+)?$/;

const EditDatabaseSettingsConfigSchema = z.object({
  type: z.enum(['embedded', 'external', 'local', 'cloud']),
  connectionString: z.string().optional(),
  url: z.string().optional(),
  token: z.string().optional(),
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

      if (data.type === 'local') {
        if (!data.url) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('EditDatabaseSettingsDialog.url.error.missing'),
            path: ['url'],
          });
          return false;
        }
      }

      if (data.type === 'cloud') {
        if (!data.token) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('EditDatabaseSettingsDialog.token.error.missingCloud'),
            path: ['token'],
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
        label: t('DatabaseSettings.types.local'),
        value: 'local',
      },
      {
        label: t('DatabaseSettings.types.cloud'),
        value: 'cloud',
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
          embeddedType: 'sqlite',
        },
      });
      return;
    }

    if (values.type === 'local') {
      void handleSetDesktopConfig({
        version: '1',
        databaseConfig: {
          type: values.type,
          url: values.url || 'http://localhost:8283',
          ...(values.token && { token: values.token }),
        },
      });
      return;
    }

    if (values.type === 'cloud') {
      void handleSetDesktopConfig({
        version: '1',
        databaseConfig: {
          type: values.type,
          token: values.token || '',
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
        <VStack gap="large">
          <Alert
            variant="brand"
            title={t('EditDatabaseSettingsDialog.description')}
          />
          <FormField
            name="type"
            render={({ field }) => {
              const selectedOption = options.find(
                (option) => option.value === field.value,
              );

              return (
                <ChipSelect
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
                      label: t('DatabaseSettings.types.local'),
                      value: 'local',
                    },
                    // Temporarily disabled
                    // {
                    //   label: t('DatabaseSettings.types.cloud'),
                    //   value: 'cloud',
                    // },
                  ]}
                />
              );
            }}
          />
          {type === 'local' && (
            <>
              <FormField
                name="url"
                render={({ field }) => {
                  return (
                    <Input
                      fullWidth
                      label={t('EditDatabaseSettingsDialog.url.label')}
                      {...field}
                      placeholder="http://localhost:8283"
                    />
                  );
                }}
              />
              <FormField
                name="token"
                render={({ field }) => {
                  return (
                    <Input
                      fullWidth
                      label={t('EditDatabaseSettingsDialog.token.label')}
                      {...field}
                      placeholder={t(
                        'EditDatabaseSettingsDialog.token.placeholder',
                      )}
                      type="password"
                    />
                  );
                }}
              />
              <TestConnectionButton
                url={form.watch('url') || 'http://localhost:8283'}
                token={form.watch('token')}
              />
            </>
          )}
          {type === 'cloud' && (
            <FormField
              name="token"
              render={({ field }) => {
                return (
                  <Input
                    fullWidth
                    label={t('EditDatabaseSettingsDialog.token.labelCloud')}
                    {...field}
                    placeholder={t(
                      'EditDatabaseSettingsDialog.token.placeholderCloud',
                    )}
                    type="password"
                  />
                );
              }}
            />
          )}
          {type === 'external' && (
            <FormField
              name="connectionString"
              render={({ field }) => {
                return (
                  <Input
                    disabled={type !== 'external'}
                    fullWidth
                    label={t(
                      'EditDatabaseSettingsDialog.connectionString.label',
                    )}
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
          )}
        </VStack>
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
                url:
                  desktopConfig.databaseConfig.type === 'local'
                    ? desktopConfig.databaseConfig.url
                    : 'http://localhost:8283',
                token:
                  desktopConfig.databaseConfig.type === 'local' ||
                  desktopConfig.databaseConfig.type === 'cloud'
                    ? desktopConfig.databaseConfig.token || ''
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
                {desktopConfig?.databaseConfig.type === 'external' &&
                  t('DatabaseSettings.types.external')}
                {desktopConfig?.databaseConfig.type === 'embedded' &&
                  t('DatabaseSettings.types.embedded')}
                {desktopConfig?.databaseConfig.type === 'local' &&
                  t('DatabaseSettings.types.local')}
                {desktopConfig?.databaseConfig.type === 'cloud' &&
                  t('DatabaseSettings.types.cloud')}
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
          {desktopConfig?.databaseConfig.type === 'local' && (
            <VStack>
              <Typography bold variant="body3">
                {t('DatabaseSettings.url')}
              </Typography>
              <HStack>
                <Typography variant="body3">
                  {desktopConfig?.databaseConfig.url}
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

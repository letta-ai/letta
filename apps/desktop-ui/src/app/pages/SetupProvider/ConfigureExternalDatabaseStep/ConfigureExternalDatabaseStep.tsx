import { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HStack,
  Input,
  LettaLogoMarkDynamic,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useCallback } from 'react';

const DatabaseConnectionPayloadSchema = z.object({
  databaseName: z.string(),
  username: z.string(),
  password: z.string(),
  host: z.string(),
  port: z.string(),
});

export type DatabaseConnectionPayload = z.infer<
  typeof DatabaseConnectionPayloadSchema
>;

interface ConfigureExternalDatabaseStepProps {
  goToNextStep: (payload: DatabaseConnectionPayload) => void;
  defaultValues?: DatabaseConnectionPayload;
  onBack: VoidFunction;
}

export function ConfigureExternalDatabaseStep(
  props: ConfigureExternalDatabaseStepProps,
) {
  const { goToNextStep, defaultValues, onBack } = props;

  const t = useTranslations('SetupProvider');

  const form = useForm<DatabaseConnectionPayload>({
    resolver: zodResolver(DatabaseConnectionPayloadSchema),
    defaultValues: {
      databaseName: defaultValues?.databaseName || '',
      username: defaultValues?.username || '',
      password: defaultValues?.password || '',
      host: defaultValues?.host || 'localhost',
      port: defaultValues?.port || '5432',
    },
  });

  const handleSubmit = useCallback(
    (data: DatabaseConnectionPayload) => {
      goToNextStep(data);
    },
    [goToNextStep],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack padding fullWidth color="background" fullHeight>
          <VStack fullHeight paddingX width="contained">
            <VStack paddingY="xxlarge">
              <VStack justify="start">
                <LettaLogoMarkDynamic size="xxlarge" />
                <Typography align="left" variant="heading1">
                  {t('ConfigureExternalDatabaseStep.title')}
                </Typography>
                <Typography variant="heading6" align="left">
                  {t('ConfigureExternalDatabaseStep.description')}
                </Typography>
              </VStack>
            </VStack>
            <VStack paddingRight="large" gap="form">
              <FormField
                name="databaseName"
                render={({ field }) => {
                  return (
                    <Input
                      fullWidth
                      labelVariant="simple"
                      label={t(
                        'ConfigureExternalDatabaseStep.step.databaseName.label',
                      )}
                      placeholder={t(
                        'ConfigureExternalDatabaseStep.step.databaseName.placeholder',
                      )}
                      {...field}
                    />
                  );
                }}
              />
              <HStack>
                <FormField
                  name="username"
                  render={({ field }) => {
                    return (
                      <Input
                        fullWidth
                        labelVariant="simple"
                        label={t(
                          'ConfigureExternalDatabaseStep.step.username.label',
                        )}
                        placeholder={t(
                          'ConfigureExternalDatabaseStep.step.username.placeholder',
                        )}
                        {...field}
                      />
                    );
                  }}
                />

                <FormField
                  name="password"
                  render={({ field }) => {
                    return (
                      <Input
                        fullWidth
                        labelVariant="simple"
                        label={t(
                          'ConfigureExternalDatabaseStep.step.password.label',
                        )}
                        placeholder={t(
                          'ConfigureExternalDatabaseStep.step.password.placeholder',
                        )}
                        type="password"
                        {...field}
                      />
                    );
                  }}
                />
              </HStack>

              <HStack>
                <FormField
                  name="host"
                  render={({ field }) => {
                    return (
                      <Input
                        fullWidth
                        labelVariant="simple"
                        label={t(
                          'ConfigureExternalDatabaseStep.step.host.label',
                        )}
                        placeholder={t(
                          'ConfigureExternalDatabaseStep.step.host.placeholder',
                        )}
                        {...field}
                      />
                    );
                  }}
                />

                <FormField
                  name="port"
                  render={({ field }) => {
                    return (
                      <Input
                        labelVariant="simple"
                        label={t(
                          'ConfigureExternalDatabaseStep.step.port.label',
                        )}
                        placeholder={t(
                          'ConfigureExternalDatabaseStep.step.port.placeholder',
                        )}
                        type="number"
                        {...field}
                      />
                    );
                  }}
                />
              </HStack>
              <HStack paddingTop="xlarge">
                <FormActions>
                  <Button
                    type="button"
                    color="tertiary"
                    size="large"
                    onClick={onBack}
                    label={t('ConfigureExternalDatabaseStep.back')}
                  />
                  <Button
                    size="large"
                    type="submit"
                    label={t('ConfigureExternalDatabaseStep.next')}
                  />
                </FormActions>
              </HStack>
            </VStack>
          </VStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

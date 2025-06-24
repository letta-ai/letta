'use client';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiContracts } from '@letta-cloud/sdk-web';
import { z } from 'zod';
import {
  Alert,
  Button,
  Form,
  FormProvider,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useCallback } from 'react';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { LoggedOutWrapper } from '../../_components/LoggedOutWrapper/LoggedOutWrapper';
import { EmailField } from '../../_components/fields';

const SSOLoginSchema = z.object({
  email: z.string(),
});

type PasswordLoginSchemaType = z.infer<typeof SSOLoginSchema>;

export default function PasswordLogin() {
  const t = useTranslations('sso-login');

  const { mutate, error, isPending, isSuccess } =
    webApi.sso.verifySSOEmail.useMutation();

  const form = useForm<PasswordLoginSchemaType>({
    resolver: zodResolver(SSOLoginSchema),
    defaultValues: {
      email: '',
    },
  });

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      invalidSSO: t('errors.invalidSSO'),
      default: t('errors.default'),
    },
    contract: webApiContracts.sso.verifySSOEmail,
  });

  const handleSubmit = useCallback(
    (values: PasswordLoginSchemaType) => {
      mutate(
        {
          body: {
            email: values.email,
          },
        },
        {
          onSuccess: (response) => {
            window.location.href = response.body.redirectUrl;
          },
        },
      );
    },
    [mutate],
  );

  return (
    <LoggedOutWrapper showSSOLogin={false}>
      <VStack fullWidth gap="xlarge">
        <VStack gap="small">
          <Typography variant="heading5" bold>
            {t('title')}
          </Typography>
          <Typography variant="body" color="muted">
            {t('description')}
          </Typography>
        </VStack>

        <FormProvider {...form}>
          <Form onSubmit={form.handleSubmit(handleSubmit)}>
            <VStack fullWidth gap="medium">
              {errorTranslation?.message && (
                <Alert title={errorTranslation.message} variant="destructive" />
              )}
              <EmailField />
              <VStack>
                <Button
                  fullWidth
                  busy={isPending || isSuccess}
                  label={t('submit')}
                />
              </VStack>
            </VStack>
          </Form>
        </FormProvider>
      </VStack>
    </LoggedOutWrapper>
  );
}

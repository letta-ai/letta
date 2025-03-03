'use client';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiContracts } from '@letta-cloud/sdk-web';
import { z } from 'zod';
import {
  Alert,
  Button,
  Form,
  FormField,
  FormProvider,
  HStack,
  Input,
  Logo,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useCallback } from 'react';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';

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
    // eslint-disable-next-line react/forbid-component-props
    <HStack gap={false} className="h-[100dvh]" fullHeight>
      <VStack
        zIndex="rightAboveZero"
        align="center"
        justify="center"
        fullHeight
        fullWidth
        color="background"
      >
        <VStack align="center" position="relative" fullWidth>
          <VStack
            /* eslint-disable-next-line react/forbid-component-props */
            className="max-w-[350px] w-full py-[48px] h-full max-h-[498px] gap-[36px]"
            align="center"
            justify="center"
            color="background-grey"
          >
            <VStack align="center" gap="xlarge">
              <Logo size="xlarge" />
              <Typography bold variant="heading5">
                {t('title')}
              </Typography>
            </VStack>
            <FormProvider {...form}>
              <Form onSubmit={form.handleSubmit(handleSubmit)}>
                <VStack paddingX="xlarge" fullWidth gap="form">
                  {errorTranslation?.message && (
                    <Alert
                      title={errorTranslation.message}
                      variant="destructive"
                    />
                  )}
                  <FormField
                    name="email"
                    render={({ field }) => (
                      <Input
                        fullWidth
                        label={t('email.label')}
                        placeholder={t('email.placeholder')}
                        type="email"
                        {...field}
                      />
                    )}
                  />
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
        </VStack>
      </VStack>
    </HStack>
  );
}

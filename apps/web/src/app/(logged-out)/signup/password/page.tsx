'use client';
import {
  Alert,
  Button,
  Form,
  FormField,
  FormProvider,
  HStack,
  InfoIcon,
  Input,
  Link,
  Logo,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useCallback, useMemo } from 'react';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { webApi, webApiContracts } from '@letta-cloud/sdk-web';

function PasswordSignupPage() {
  const { mutate, error, isPending, isSuccess } =
    webApi.user.createAccountWithPassword.useMutation();

  const t = useTranslations('pages/password');
  const PasswordSignupFormSchema = useMemo(() => {
    return z
      .object({
        name: z.string(),
        email: z.string().email(),
        password: z.string().min(6, {
          message: t('errors.passwordMinLength'),
        }),
        confirmPassword: z.string(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: t('errors.passwordMismatch'),
        path: ['confirmPassword'],
      });
  }, [t]);

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      emailAlreadyTaken: t('errors.emailAlreadyTaken'),
      default: t('errors.default'),
    },
    contract: webApiContracts.user.createAccountWithPassword,
  });

  type EmailFormValues = z.infer<typeof PasswordSignupFormSchema>;
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(PasswordSignupFormSchema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
    },
  });

  const handleSubmit = useCallback(
    (data: EmailFormValues) => {
      mutate(
        {
          body: {
            email: data.email,
            name: data.name,
            password: data.password,
          },
        },
        {
          onSuccess: () => {
            window.location.href = '/';
          },
        },
      );
    },
    [mutate],
  );

  return (
    <HStack
      gap={false}
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[100dvh]"
      fullHeight
    >
      <VStack
        zIndex="rightAboveZero"
        align="center"
        justify="center"
        fullHeight
        fullWidth
        color="background"
      >
        <VStack
          /* eslint-disable-next-line react/forbid-component-props */
          className="max-w-[400px] w-full py-[48px]   gap-[36px]"
          align="center"
          justify="center"
          paddingX
          color="background-grey"
        >
          <VStack align="center" gap="xlarge">
            <div className="relative">
              <Logo size="xlarge" />
            </div>
            <Typography bold variant="heading5">
              {t('title')}
            </Typography>
          </VStack>
          <VStack gap="form" fullWidth paddingX="xlarge">
            <FormProvider {...form}>
              <Form onSubmit={form.handleSubmit(handleSubmit)}>
                {errorTranslation?.message && (
                  <Alert
                    title={errorTranslation.message}
                    variant="destructive"
                  />
                )}
                <FormField
                  name="name"
                  render={({ field }) => (
                    <Input
                      fullWidth
                      label={t('name.label')}
                      placeholder={t('name.placeholder')}
                      {...field}
                    />
                  )}
                />
                <FormField
                  name="email"
                  render={({ field }) => (
                    <Input
                      fullWidth
                      label={t('email.label')}
                      placeholder={t('email.placeholder')}
                      {...field}
                    />
                  )}
                />
                <FormField
                  name="password"
                  render={({ field }) => (
                    <Input
                      fullWidth
                      label={t('password.label')}
                      placeholder={t('password.placeholder')}
                      type="password"
                      {...field}
                    />
                  )}
                />

                <FormField
                  name="confirmPassword"
                  render={({ field }) => (
                    <Input
                      fullWidth
                      label={t('confirmPassword.label')}
                      placeholder={t('confirmPassword.placeholder')}
                      type="password"
                      {...field}
                    />
                  )}
                />
                <VStack color="background-grey2" padding="large">
                  <InfoIcon />
                  <Typography variant="body2">
                    {t.rich('info', {
                      link: (chunks) => <Link href="/signup">{chunks}</Link>,
                    })}
                  </Typography>
                </VStack>
                <Button
                  busy={isPending || isSuccess}
                  fullWidth
                  type="submit"
                  label={t('submit')}
                />
                <Typography variant="body3">
                  {t.rich('terms', {
                    terms: (chunks) => (
                      <a
                        className="underline"
                        href="https://letta.com/terms-of-service"
                      >
                        {chunks}
                      </a>
                    ),
                    privacy: (chunks) => (
                      <a
                        className="underline"
                        href="https://letta.com/privacy-policy"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </Typography>
              </Form>
            </FormProvider>
          </VStack>
        </VStack>
      </VStack>
    </HStack>
  );
}

export default PasswordSignupPage;

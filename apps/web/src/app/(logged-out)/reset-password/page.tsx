'use client';
import { LoggedOutWrapper } from '../_components/LoggedOutWrapper/LoggedOutWrapper';
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
import React, { useCallback } from 'react';
import { webApi, webApiContracts } from '@letta-cloud/sdk-web';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from '@letta-cloud/translations';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { useSearchParams } from 'next/navigation';

export default function ForgotPasswordPage() {
  const t = useTranslations('reset-password');

  const forgetPasswordSchema = z
    .object({
      password: z.string().min(8, { message: t('errors.minLength') }),
      confirmPassword: z.string().min(8, { message: t('errors.minLength') }),
      code: z.string().min(1, { message: t('errors.codeRequired') }),
      email: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('errors.passwordMismatch'),
      path: ['confirmPassword'],
    });

  type ForgetPasswordFormType = z.infer<typeof forgetPasswordSchema>;

  const { mutate, isPending, error } =
    webApi.user.updatePasswordFromForgotPassword.useMutation({
      onSuccess: () => {
        window.location.href = '/login';
      },
    });

  const errorMessage = useErrorTranslationMessage(error, {
    messageMap: {
      invalidCode: t('errors.invalidCode'),
      codeExpired: t('errors.codeExpired'),
      default: t('errors.default'),
    },
    contract: webApiContracts.user.updatePasswordFromForgotPassword,
  });

  const params = useSearchParams();

  const form = useForm<ForgetPasswordFormType>({
    resolver: zodResolver(forgetPasswordSchema),
    defaultValues: {
      email: params.get('email')
        ? decodeURIComponent(params.get('email') || '')
        : '',
      code: params.get('code') || '',
    },
  });

  const handleSubmit = useCallback(
    (data: ForgetPasswordFormType) => {
      mutate({
        body: {
          email: data.email,
          code: data.code,
          password: data.password,
        },
      });
    },
    [mutate],
  );

  return (
    <FormProvider {...form}>
      <LoggedOutWrapper>
        <VStack padding fullWidth align="center" paddingY>
          <HStack>
            <Logo size="large" />
          </HStack>
          {errorMessage?.message && (
            <Alert title={errorMessage.message} variant="destructive" />
          )}
          <Typography>{t('title')}</Typography>
          <Form onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              name="email"
              render={({ field }) => (
                <Input fullWidth label={t('email.label')} disabled {...field} />
              )}
            />
            <FormField
              name="password"
              render={({ field }) => (
                <Input
                  type="password"
                  fullWidth
                  label={t('password.label')}
                  {...field}
                />
              )}
            />
            <FormField
              name="confirmPassword"
              render={({ field }) => (
                <Input
                  type="password"
                  fullWidth
                  label={t('confirmPassword.label')}
                  {...field}
                />
              )}
            />
            <FormField
              name="code"
              render={({ field }) => (
                <Input fullWidth label={t('code.label')} {...field} />
              )}
            />
            <Button
              fullWidth
              type="submit"
              label={t('confirm')}
              busy={isPending}
            />
          </Form>
        </VStack>
      </LoggedOutWrapper>
    </FormProvider>
  );
}

'use client';
import { LoggedOutWrapper } from '../_components/LoggedOutWrapper/LoggedOutWrapper';
import {
  Button,
  Form,
  FormField,
  FormProvider,
  HStack,
  Input,
  Logo,
  toast,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback } from 'react';
import { webApi } from '@letta-cloud/sdk-web';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from '@letta-cloud/translations';

const forgetPasswordSchema = z.object({
  email: z.string().email(),
});

type ForgetPasswordFormType = z.infer<typeof forgetPasswordSchema>;

export default function ForgotPasswordPage() {
  const t = useTranslations('forgot-password');
  const { mutate, isPending } = webApi.user.startForgotPassword.useMutation({
    onSuccess: () => {
      toast.success(t('success'));
    },
  });

  const form = useForm<ForgetPasswordFormType>({
    resolver: zodResolver(forgetPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleSubmit = useCallback(
    (data: ForgetPasswordFormType) => {
      mutate({
        body: {
          email: data.email,
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
          <Typography>{t('title')}</Typography>
          <Form onSubmit={form.handleSubmit(handleSubmit)}>
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

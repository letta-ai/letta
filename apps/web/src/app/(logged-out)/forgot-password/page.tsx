'use client';
import { LoggedOutWrapper } from '../_components/LoggedOutWrapper/LoggedOutWrapper';
import {
  Button,
  Form,
  FormProvider,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useState } from 'react';
import { webApi } from '@letta-cloud/sdk-web';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from '@letta-cloud/translations';
import { useSearchParams } from 'next/navigation';
import { EmailField } from '../_components/fields';

const forgetPasswordSchema = z.object({
  email: z.string().email(),
});

type ForgetPasswordFormType = z.infer<typeof forgetPasswordSchema>;

export default function ForgotPasswordPage() {
  const t = useTranslations('forgot-password');
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const { mutate, isPending } = webApi.user.startForgotPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
    },
  });

  const form = useForm<ForgetPasswordFormType>({
    resolver: zodResolver(forgetPasswordSchema),
    defaultValues: {
      email: emailParam,
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
      {success ? (
        <ResetLinkSent />
      ) : (
        <LoggedOutWrapper showTerms={false}>
          <VStack fullWidth paddingY gap="xlarge">
            <VStack gap="medium">
              <Typography variant="heading5" bold>
                {t('title')}
              </Typography>
              <Typography variant="body" color="muted">
                {t('description')}
              </Typography>
            </VStack>

            <Form onSubmit={form.handleSubmit(handleSubmit)}>
              <EmailField />
              <Button
                fullWidth
                type="submit"
                label={t('confirm')}
                busy={isPending}
              />
            </Form>
          </VStack>
        </LoggedOutWrapper>
      )}
    </FormProvider>
  );
}

function ResetLinkSent() {
  const t = useTranslations('forgot-password');
  return (
    <LoggedOutWrapper showTerms={false} showSSOLogin={false}>
      <VStack fullWidth paddingBottom={'medium'}>
        <Typography variant="heading5" bold>
          {t('success.title')}
        </Typography>
        <Typography variant="body" color="muted">
          {t('success.description')}
        </Typography>
      </VStack>
    </LoggedOutWrapper>
  );
}

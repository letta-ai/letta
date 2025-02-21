'use client';
import {
  Alert,
  Button,
  Form,
  FormField,
  FormProvider,
  HR,
  HStack,
  Input,
  LoadingEmptyStatusComponent,
  Logo,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/component-library';
import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  webApi,
  webApiContracts,
  webApiQueryKeys,
} from '@letta-cloud/web-api-client';
import { isFetchError } from '@ts-rest/react-query/v5';
import { OAuthButtons } from '../OAuthButtons/OAuthButtons';
import { LoginErrorsEnum } from '$web/errors';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useErrorTranslationMessage } from '@letta-cloud/helpful-client-utils';

function RedirectToLogin() {
  const { push } = useRouter();

  React.useEffect(() => {
    push('/login');
  }, [push]);

  return null;
}

type SignupMode = 'email' | 'oauth';

interface EmailRegistrationProps {
  email: string;
  code: string;
}

function EmailRegistration(props: EmailRegistrationProps) {
  const { email, code } = props;
  const t = useTranslations('signup-via-invite');

  const { mutate, error, isPending, isSuccess } =
    webApi.user.createAccountWithPassword.useMutation();

  const emailFormSchema = z
    .object({
      name: z.string(),
      email: z.string(),
      password: z.string().min(6, {
        message: t('EmailRegistration.errors.passwordMinLength'),
      }),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('EmailRegistration.errors.passwordMismatch'),
      path: ['confirmPassword'],
    });

  type EmailFormValues = z.infer<typeof emailFormSchema>;

  const form = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email,
      name: '',
      password: '',
      confirmPassword: '',
    },
  });

  const errorTranslation = useErrorTranslationMessage(error, {
    messageMap: {
      emailAlreadyTaken: t('EmailRegistration.errors.emailAlreadyTaken'),
      invalidInviteCode: t('EmailRegistration.errors.invalidInviteCode'),
      default: t('EmailRegistration.errors.default'),
    },
    contract: webApiContracts.user.createAccountWithPassword,
  });

  const handleSubmit = useCallback(
    (data: EmailFormValues) => {
      mutate(
        {
          body: {
            email,
            name: data.name,
            password: data.password,
            inviteCode: code,
          },
        },
        {
          onSuccess: () => {
            window.location.href = '/';
          },
        },
      );
    },
    [code, email, mutate],
  );

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        {errorTranslation?.message && (
          <Alert title={errorTranslation.message} variant="destructive" />
        )}
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('EmailRegistration.name.label')}
              placeholder={t('EmailRegistration.name.placeholder')}
              {...field}
            />
          )}
        />
        <FormField
          name="email"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('EmailRegistration.email.label')}
              placeholder={t('EmailRegistration.email.placeholder')}
              disabled
              {...field}
            />
          )}
        />
        <FormField
          name="password"
          render={({ field }) => (
            <Input
              fullWidth
              label={t('EmailRegistration.password.label')}
              placeholder={t('EmailRegistration.password.placeholder')}
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
              label={t('EmailRegistration.confirmPassword.label')}
              placeholder={t('EmailRegistration.confirmPassword.placeholder')}
              type="password"
              {...field}
            />
          )}
        />
        <VStack fullWidth paddingTop>
          <Button
            fullWidth
            busy={isPending || isSuccess}
            label={t('EmailRegistration.submit')}
            type="submit"
          />
        </VStack>
      </Form>
    </FormProvider>
  );
}

export default function SignupViaInvite() {
  const t = useTranslations('signup-via-invite');
  const params = useSearchParams();

  const [mode, setMode] = React.useState<SignupMode>('oauth');

  const code = params.get('code') || '';

  const { data, error } = webApi.organizations.getInviteByCode.useQuery({
    queryData: {
      params: {
        inviteCode: code,
      },
    },

    retry: false,
    queryKey: webApiQueryKeys.organizations.getInviteByCode(code),
  });

  const errorMessage = useMemo(() => {
    if (!error) {
      return '';
    }

    if (isFetchError(error)) {
      return t('errors.default');
    }

    if (error.status === 404) {
      return t('errors.invalid');
    }

    return t('errors.default');
  }, [error, t]);

  const searchCode = new URLSearchParams();

  const signupErrorMessage = useMemo(() => {
    const code = params.get('errorCode');

    if (!code) {
      return '';
    }

    if (code === LoginErrorsEnum.EXPIRED_INVITE_CODE) {
      return t('errors.expired');
    }

    if (code === LoginErrorsEnum.INVALID_INVITE_CODE) {
      return t('errors.invalid');
    }

    if (code === LoginErrorsEnum.INVITE_MISMATCH_EMAIL) {
      return t('errors.mismatch');
    }

    return t('errors.default');
  }, [params, t]);

  searchCode.set('inviteCode', code);

  if (!code) {
    return <RedirectToLogin />;
  }

  return (
    // eslint-disable-next-line react/forbid-component-props
    <HStack gap={false} className="login-container h-[100dvh]" fullHeight>
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
          className="w-full  max-w-[350px]"
          align="center"
          justify="center"
          padding
          color="background-grey"
        >
          {!data ? (
            <LoadingEmptyStatusComponent
              isError={!!errorMessage}
              isLoading={!errorMessage}
              errorMessage={errorMessage}
              loadingMessage={t('loading')}
            />
          ) : (
            <VStack>
              {signupErrorMessage && (
                <Alert title={signupErrorMessage} variant="destructive" />
              )}
              <VStack align="center" paddingY>
                <HStack>
                  <Logo size="large" />
                </HStack>
                <Typography variant="heading5" as="h1">
                  {t('title')}
                </Typography>
                <Typography variant="body">
                  {t('description', {
                    organizationName: data.body.organizationName,
                  })}
                </Typography>
                <VStack gap="large" fullWidth paddingY="small">
                  <HR />
                  <Typography variant="body">{t('more')}</Typography>
                </VStack>

                {mode === 'oauth' ? (
                  <>
                    <OAuthButtons searchParams={searchCode} />
                    <Button
                      onClick={() => setMode('email')}
                      fullWidth
                      color="secondary"
                      label={t('emailSignup')}
                    />
                  </>
                ) : (
                  <>
                    <EmailRegistration email={data.body.email} code={code} />
                    <Button
                      onClick={() => setMode('oauth')}
                      fullWidth
                      color="tertiary"
                      label={t('oauthSignup')}
                    />
                  </>
                )}
              </VStack>
            </VStack>
          )}
        </VStack>
      </VStack>
    </HStack>
  );
}

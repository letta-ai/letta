'use client';
import {
  Alert,
  Button,
  Form,
  FormProvider,
  LoadingEmptyStatusComponent,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useRouter, useSearchParams } from 'next/navigation';
import { webApi, webApiContracts, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { isFetchError } from '@ts-rest/react-query/v5';
import { OAuthButtons } from '../OAuthButtons/OAuthButtons';
import { LoginErrorsEnum } from '$web/errors';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useErrorTranslationMessage } from '@letta-cloud/utils-client';
import { LoggedOutWrapper } from '../_components/LoggedOutWrapper/LoggedOutWrapper';
import { Mode } from '../constants';
import {
  EmailField,
  PasswordAndConfirmationFields,
} from '../_components/fields';
import { spinOnClickForLogo, useIsEmailSignupEnabled } from '../libs';

function RedirectToLogin() {
  const { push } = useRouter();

  React.useEffect(() => {
    push('/login');
  }, [push]);

  return null;
}

interface EmailRegistrationProps {
  email: string;
  code: string;
}

function EmailRegistration(props: EmailRegistrationProps) {
  const { email, code } = props;
  const t = useTranslations('signup-via-invite');
  const [isEmailEntered, setIsEmailEntered] = useState<boolean>(false);
  const [passwordValue, setPasswordValue] = useState<string>('');
  const extraFieldsRef = useRef<HTMLDivElement>(null);

  const { mutate, error, isPending, isSuccess } =
    webApi.user.createAccountWithPasswordAndInviteCode.useMutation();

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
    contract: webApiContracts.user.createAccountWithPasswordAndInviteCode,
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
    <VStack>
      <FormProvider {...form}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (isEmailEntered) {
              void form.handleSubmit(handleSubmit)(e);
            } else {
              setIsEmailEntered(true);
              if (extraFieldsRef.current) {
                extraFieldsRef.current.classList.add('show');
              }
            }
          }}
        >
          {errorTranslation?.message && (
            <Alert title={errorTranslation.message} variant="destructive" />
          )}

          <EmailField />

          <div className="extra-fields" id="extraFields" ref={extraFieldsRef}>
            <PasswordAndConfirmationFields
              passwordValue={passwordValue}
              setPasswordValue={setPasswordValue}
            />
          </div>
          <Button
            fullWidth
            busy={isPending || isSuccess}
            label={
              isEmailEntered ? t('EmailRegistration.submit') : t('emailSignup')
            }
            type="submit"
          />
        </Form>
      </FormProvider>
    </VStack>
  );
}

export default function SignupViaInvite() {
  const t = useTranslations('signup-via-invite');
  const params = useSearchParams();
  const logoRef = useRef<HTMLDivElement>(null);

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

  const isEmailEnabled = useIsEmailSignupEnabled();

  const spinOnClick = useCallback(() => {
    spinOnClickForLogo(logoRef);
  }, []);

  if (!code) {
    return <RedirectToLogin />;
  }

  return (
    <LoggedOutWrapper showSSOLogin={false}>
      {!data ? (
        <LoadingEmptyStatusComponent
          isError={!!errorMessage}
          isLoading={!errorMessage}
          errorMessage={errorMessage}
          loadingMessage={t('loading')}
        />
      ) : (
        <VStack align="center" position="relative" fullWidth>
          <VStack fullWidth gap="xlarge">
            <VStack gap="medium">
              <Typography variant="heading5">
                {t('title', {
                  organizationName: data.body.organizationName,
                })}
              </Typography>
              <Typography variant="body">{t('description')}</Typography>
              <Typography variant="body" bold>
                {data.body.email}
              </Typography>
            </VStack>
            {signupErrorMessage && (
              <Alert title={signupErrorMessage} variant="destructive" />
            )}
            <OAuthButtons
              type={Mode.SIGNUP}
              spinOnClick={spinOnClick}
              searchParams={searchCode}
            />
            {isEmailEnabled && (
              <>
                <EmailRegistration email={data.body.email} code={code} />
              </>
            )}
          </VStack>
        </VStack>
      )}
    </LoggedOutWrapper>
  );
}

'use client';
import {
  Alert,
  HR,
  HStack,
  LoadingEmptyStatusComponent,
  Logo,
  Typography,
  VStack,
} from '@letta-cloud/component-library';
import React, { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useRouter, useSearchParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import { isFetchError } from '@ts-rest/react-query/v5';
import { OAuthButtons } from '../OAuthButtons/OAuthButtons';
import { LoginErrorsEnum } from '$web/errors';

function RedirectToLogin() {
  const { push } = useRouter();

  React.useEffect(() => {
    push('/login');
  }, [push]);

  return null;
}

export default function SignupViaInvite() {
  const t = useTranslations('signup-via-invite');
  const params = useSearchParams();

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

                <OAuthButtons searchParams={searchCode} />
              </VStack>
            </VStack>
          )}
        </VStack>
      </VStack>
    </HStack>
  );
}

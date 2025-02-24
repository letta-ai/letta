'use client';
import {
  Typography,
  VStack,
  Logo,
  Button,
  KeyIcon,
  OfficesIcon,
} from '@letta-cloud/component-library';
import { Suspense } from 'react';
import { useMemo } from 'react';
import { useCallback, useRef } from 'react';
import { isNull } from 'lodash-es';
import './Login.scss';
import { useSearchParams } from 'next/navigation';
import { isTextALoginError, LoginErrorsMap } from '$web/errors';
import { useTranslations } from '@letta-cloud/translations';
import { OAuthButtons } from '../OAuthButtons/OAuthButtons';

function LoginErrorBanner() {
  const searchParams = useSearchParams();

  const message = searchParams.get('errorCode');

  const errorMessage = useMemo(() => {
    if (isTextALoginError(message)) {
      return LoginErrorsMap[message];
    }
  }, [message]);

  if (!errorMessage) {
    return null;
  }

  return (
    <div className="fade-in-0 absolute top-[-90px] slide-in-from-bottom-2 text-mono mt-4 animate-in  p-1 px-4">
      {errorMessage}
    </div>
  );
}

export function LoginComponent() {
  const t = useTranslations('login/LoginComponent');
  const logoRef = useRef<HTMLDivElement>(null);

  const spinOnClick = useCallback(() => {
    if (isNull(logoRef.current)) {
      return;
    }

    logoRef.current.style.animation = 'logo-spin 3s linear forwards';
    logoRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
  }, []);

  const searchParams = useSearchParams();

  return (
    <VStack align="center" position="relative" fullWidth>
      <Suspense>
        <LoginErrorBanner />
      </Suspense>
      <VStack
        /* eslint-disable-next-line react/forbid-component-props */
        className="max-w-[350px] w-full py-[48px] h-full max-h-[498px] gap-[36px]"
        align="center"
        justify="center"
        color="background-grey"
      >
        <VStack
          /* eslint-disable-next-line react/forbid-component-props */
          className="max-w-[262px]"
          gap="xlarge"
          align="center"
        >
          <VStack align="center" gap="xlarge">
            <div className="relative" ref={logoRef}>
              <Logo size="xlarge" />
            </div>
            <Typography bold variant="heading5">
              {t('title')}
            </Typography>
          </VStack>
          <OAuthButtons spinOnClick={spinOnClick} searchParams={searchParams} />
          <VStack paddingX="small">
            <Typography variant="body3">{t('corporateLogin')}</Typography>
            <Button
              label={t('loginWithPassword')}
              fullWidth
              preIcon={<KeyIcon />}
              color="secondary"
              href="/login/password"
            />
            <Button
              label={t('loginWithSSO')}
              fullWidth
              preIcon={<OfficesIcon />}
              color="secondary"
              href="/login/sso"
            />
          </VStack>
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
        </VStack>
      </VStack>
    </VStack>
  );
}

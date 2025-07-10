import {
  Button,
  LettaLoader,
  OfficesIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { HStack } from '@letta-cloud/ui-component-library';
import { Typography } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import React, { useEffect, useState } from 'react';
import type { Ref } from 'react';
import { usePathname } from 'next/navigation';
import { AuthFlowSwitch } from './AuthFlowSwitch';
import './Login.scss';
import type { Mode } from '../../constants';

interface LoggedOutWrapperProps {
  children: React.ReactNode;
  showTerms?: boolean;
  showSSOLogin?: boolean;
  showAuthFlowSwitcher?: boolean;
  showLogo?: boolean;
  logoRef?: Ref<HTMLDivElement> | null;
  cardWidth?: number;
}

export function LoggedOutWrapper(props: LoggedOutWrapperProps) {
  const {
    children,
    logoRef,
    showTerms = true,
    showSSOLogin = true,
    showAuthFlowSwitcher = true,
    showLogo = true,
    cardWidth = 400,
  } = props;

  const mode = usePathname().substring(1) as Mode;
  const t = useTranslations('login/LoginComponent');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    function listener(e: MediaQueryListEvent) {
      setIsDarkMode(e.matches);
    }
    mediaQuery.addEventListener('change', listener);

    return () => {
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  return (
    <HStack
      overflow="auto"
      gap={false}
      // eslint-disable-next-line react/forbid-component-props
      className="login-container max-h-[100dvh] box-content  "
    >
      <VStack
        zIndex="rightAboveZero"
        align="center"
        justify="center"
        fullHeight
        fullWidth
        color="background"
        // eslint-disable-next-line react/forbid-component-props
        className="signup-background"
        gap={null}
      >
        <VStack
          // eslint-disable-next-line react/forbid-component-props
          className={`w-full border card`}
          // eslint-disable-next-line react/forbid-component-props
          style={{
            maxWidth: `${cardWidth}px`,
            maxHeight: '100%',
          }}
          align="center"
          gap="large"
          justify="center"
          padding="xxlarge"
          color="background-grey"
        >
          {showLogo && (
            <VStack paddingBottom="small" gap="xlarge" align="center" fullWidth>
              <HStack justify="spaceBetween" align="center" fullWidth>
                {showLogo && (
                  <div
                    className="relative lottie-non-interactive"
                    ref={logoRef}
                  >
                    <LettaLoader
                      variant="spinner3d"
                      size="big"
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}
                {showAuthFlowSwitcher && <AuthFlowSwitch mode={mode} />}
              </HStack>
            </VStack>
          )}
          {children}
        </VStack>
        {showSSOLogin && (
          <VStack
            // eslint-disable-next-line react/forbid-component-props
            className={`w-full border-x border-b card`}
            // eslint-disable-next-line react/forbid-component-props
            style={{
              maxWidth: `${cardWidth}px`,
            }}
            align="center"
            justify="center"
            padding="xlarge"
            color="background-grey"
          >
            <HStack
              fullWidth
              justify="spaceBetween"
              align="center"
              paddingLeft="small"
              paddingRight="small"
            >
              <Typography align="center" variant="body2" color="lighter">
                {t('corporateLogin')}
              </Typography>
              <Button
                label={t('loginWithSSO')}
                preIcon={<OfficesIcon />}
                href="/login/sso"
                size="xsmall"
                color="tertiary"
                bold
              />
            </HStack>
          </VStack>
        )}
        {showTerms && (
          <VStack
            // eslint-disable-next-line react/forbid-component-props
            className={`w-full`}
            // eslint-disable-next-line react/forbid-component-props
            style={{
              maxWidth: `${cardWidth}px`,
            }}
            align="center"
            justify="center"
            gap="xlarge"
            padding="xlarge"
          >
            <Typography variant="body2" align="center" color="lighter">
              {t('info')}
            </Typography>
            <Typography variant="body2" align="center" color="lighter" preWrap>
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
        )}
      </VStack>
    </HStack>
  );
}

import {
  Button,
  Logo,
  OfficesIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { HStack } from '@letta-cloud/ui-component-library';
import { Typography } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
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
  logoRef?: Ref<HTMLDivElement> | null;
}

export function LoggedOutWrapper(props: LoggedOutWrapperProps) {
  const {
    children,
    logoRef,
    showTerms = true,
    showSSOLogin = true,
    showAuthFlowSwitcher = true,
  } = props;

  const mode = usePathname().substring(1) as Mode;
  const t = useTranslations('login/LoginComponent');

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
        // eslint-disable-next-line react/forbid-component-props
        className="signup-background"
        gap={null}
      >
        <VStack
          // eslint-disable-next-line react/forbid-component-props
          className="w-full max-w-[400px] border card"
          align="center"
          gap="large"
          justify="center"
          padding="xxlarge"
          color="background-grey"
        >
          <VStack paddingBottom="small" gap="xlarge" align="center" fullWidth>
            <HStack justify="spaceBetween" align="center" fullWidth>
              <div className="relative" ref={logoRef}>
                <Logo size="big" />
              </div>
              {showAuthFlowSwitcher && <AuthFlowSwitch mode={mode} />}
            </HStack>
          </VStack>
          {children}
        </VStack>
        {showSSOLogin && (
          <VStack
            // eslint-disable-next-line react/forbid-component-props
            className="w-full max-w-[400px] border-x border-b card"
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
            className="w-full max-w-[400px]"
            align="center"
            justify="center"
            gap="xlarge"
            padding="xlarge"
          >
            <Typography variant="body2" align="center" color="lighter">
              {t('info')}
            </Typography>
            <Typography variant="body2" align="center" color="lighter">
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

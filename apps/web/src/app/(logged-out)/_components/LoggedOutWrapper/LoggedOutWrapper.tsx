import {
  Button,
  OfficesIcon,
  VStack,
  HStack,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import React from 'react';
import type { Ref } from 'react';
import { usePathname } from 'next/navigation';
import { AuthFlowSwitch } from './AuthFlowSwitch';
import { AuthWrapper } from '../../../_components/AuthWrapper';
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

  const headerContent = showAuthFlowSwitcher ? (
    <AuthFlowSwitch mode={mode} />
  ) : null;

  const bottomCard = showSSOLogin ? (
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
  ) : null;

  const termsContent = showTerms ? (
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
            <a className="underline" href="https://letta.com/terms-of-service">
              {chunks}
            </a>
          ),
          privacy: (chunks) => (
            <a className="underline" href="https://letta.com/privacy-policy">
              {chunks}
            </a>
          ),
        })}
      </Typography>
    </VStack>
  ) : null;

  return (
    <AuthWrapper
      containerClassName="login-container"
      backgroundClassName="signup-background"
      showLogo={showLogo}
      logoRef={logoRef}
      cardWidth={cardWidth}
      headerContent={headerContent}
      bottomCard={
        <>
          {bottomCard}
          {termsContent}
        </>
      }
    >
      {children}
    </AuthWrapper>
  );
}

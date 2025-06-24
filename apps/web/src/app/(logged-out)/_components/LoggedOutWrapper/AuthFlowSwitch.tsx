import {
  HStack,
  Typography,
  ChevronLeftIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { Mode } from '../../constants';

interface AuthFlowSwitchProps {
  mode: Mode;
}

export function AuthFlowSwitch({ mode }: AuthFlowSwitchProps) {
  const t = useTranslations('login/AuthFlowSwitcher');

  const modeTranslationMap = {
    [Mode.FORGOT_PASSWORD]: {
      linkText: t('forgot-password.labelText'),
      preButtonIcon: '',
      buttonText: t('forgot-password.buttonText'),
      href: '/login',
    },
    [Mode.RESET_PASSWORD]: {
      linkText: '',
      preButtonIcon: '',
      buttonText: t('reset-password.buttonText'),
      href: '/login',
    },
    [Mode.LOGIN]: {
      linkText: t('login.labelText'),
      preButtonIcon: '',
      buttonText: t('login.buttonText'),
      href: '/signup',
    },
    [Mode.SIGNUP]: {
      linkText: t('signup.labelText'),
      preButtonIcon: '',
      buttonText: t('signup.buttonText'),
      href: '/login',
    },
    [Mode.SSO]: {
      linkText: t('sso.labelText'),
      preButtonIcon: <ChevronLeftIcon />,
      buttonText: t('sso.buttonText'),
      href: '/login',
    },
  };

  const modeConfig = modeTranslationMap[mode];

  return (
    <HStack gap={'small'}>
      <Typography variant="body2">{modeConfig?.linkText}</Typography>
      {modeConfig?.preButtonIcon}
      <Typography variant="body2" bold>
        <a className="text-link" href={modeConfig?.href}>
          {modeConfig?.buttonText}
        </a>
      </Typography>
    </HStack>
  );
}

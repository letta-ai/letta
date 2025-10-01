import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import React from 'react';
import {
  useSetOnboardingStep,
  useUnpauseOnboarding,
} from '@letta-cloud/sdk-web';
import {
  Button,
  ExternalLink,
  Section,
  Typography,
} from '@letta-cloud/ui-component-library';

interface StatusUIProps {
  title: React.ReactNode;
  children: React.ReactNode;
}

function StatusUI(props: StatusUIProps) {
  const { title, children } = props;
  const t = useTranslations('settings/profile/page/OnboardingSupportUI');

  return (
    <Section title={t('title')}>
      <Typography variant="body2">{title}</Typography>
      <div>{children}</div>
    </Section>
  );
}

function RestartOnboarding() {
  const t = useTranslations('settings/profile/page/OnboardingSupportUI');

  const { setOnboardingStep } = useSetOnboardingStep();

  return (
    <StatusUI
      title={t.rich('RestartOnboarding.title', {
        link: (chunks) => (
          <ExternalLink href="https://youtu.be/of4aFbUKjbk?feature=shared&t=8&autoplay=1">
            {chunks}
          </ExternalLink>
        ),
      })}
    >
      <Button
        data-testid="retry-onboarding-button"
        color="secondary"
        label={t('RestartOnboarding.button')}
        onClick={() => {
          setOnboardingStep({
            onboardingStep: 'restarted',
          });
        }}
      ></Button>
    </StatusUI>
  );
}

function UnpauseOnboarding() {
  const t = useTranslations('settings/profile/page/OnboardingSupportUI');

  const { unpauseOnboarding } = useUnpauseOnboarding();

  return (
    <StatusUI title={t('UnpauseOnboarding.title')}>
      <Button
        color="secondary"
        data-testid="unpause-onboarding-button"
        label={t('UnpauseOnboarding.button')}
        onClick={() => {
          unpauseOnboarding();
        }}
      ></Button>
    </StatusUI>
  );
}

function InOnboarding() {
  const t = useTranslations('settings/profile/page/OnboardingSupportUI');

  const { setOnboardingStep } = useSetOnboardingStep();

  return (
    <StatusUI title={t('InOnboarding.title')}>
      <Button
        color="secondary"
        label={t('InOnboarding.button')}
        onClick={() => {
          setOnboardingStep({
            onboardingStep: 'restarted',
          });
        }}
      ></Button>
    </StatusUI>
  );
}

export function OnboardingSupportUI() {
  const user = useCurrentUser();

  if (user?.onboardingStatus?.pausedAt) {
    return <UnpauseOnboarding />;
  }

  if (user?.onboardingStatus?.currentStep === 'completed') {
    return <RestartOnboarding />;
  }

  return <InOnboarding />;
}

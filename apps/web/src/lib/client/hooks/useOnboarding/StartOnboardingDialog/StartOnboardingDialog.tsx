import Astronaut from './astronaut.webp';
import {
  Badge,
  Button,
  ConfirmPauseOnboardingDialog,
  HStack,
  OnboardingPrimaryDialog,
  OnboardingPrimaryHeading,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { useCallback, useState } from 'react';
import { useSetOnboardingStep } from '@letta-cloud/sdk-web';
import { MainOnboardingSteps } from '$web/client/hooks/useOnboarding/components/MainOnboardingSteps/MainOnboardingSteps';
import { useRouter } from 'next/navigation';

export function StartOnboardingDialog() {
  const t = useTranslations('onboarding/StartOnboardingDialog');

  const { setOnboardingStep, isPending, isSuccess } = useSetOnboardingStep();
  const [redirecting, setRedirecting] = useState(false);

  const { push } = useRouter();
  const handleStart = useCallback(() => {
    setRedirecting(true);

    setOnboardingStep({
      onboardingStep: 'about_credits',
      onSuccess: () => {
        push('/models');
      },
    });
  }, [setOnboardingStep, push]);

  const user = useCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <OnboardingPrimaryDialog
      imageUrl={Astronaut}
      title={t('title')}
      isOpen
      secondaryAction={
        <ConfirmPauseOnboardingDialog
          trigger={<Button color="tertiary" size="large" label={t('skip')} />}
        />
      }
      primaryAction={
        <Button
          busy={isPending || isSuccess || redirecting}
          onClick={handleStart}
          size="large"
          label={t('startModels')}
        />
      }
    >
      <VStack>
        <OnboardingPrimaryHeading
          badge={
            <HStack>
              <Badge variant="default" border content={t('time')} />
            </HStack>
          }
          title={t('title')}
          description={t('description')}
        ></OnboardingPrimaryHeading>
        <MainOnboardingSteps />
      </VStack>
    </OnboardingPrimaryDialog>
  );
}

import Astronaut from './astronaut.webp';
import {
  Badge,
  Button,
  ConfirmPauseOnboardingDialog,
  HStack,
  LettaCoinIcon,
  OnboardingPrimaryDialog,
  OnboardingPrimaryHeading,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { useCallback } from 'react';
import { useSetOnboardingStep } from '@letta-cloud/sdk-web';
import { stepToRewardMap } from '@letta-cloud/types';
import { MainOnboardingSteps } from '$web/client/hooks/useOnboarding/components/MainOnboardingSteps/MainOnboardingSteps';

export function StartOnboardingDialog() {
  const t = useTranslations('onboarding/StartOnboardingDialog');

  const { setOnboardingStep, isPending, isSuccess } = useSetOnboardingStep();

  const handleStart = useCallback(() => {
    setOnboardingStep({
      onboardingStep: 'about_credits',
    });
  }, [setOnboardingStep]);

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
          busy={isPending || isSuccess}
          onClick={handleStart}
          size="large"
          label={t('start')}
        />
      }
    >
      <VStack>
        <OnboardingPrimaryHeading
          badge={
            <HStack>
              <Badge
                variant="success"
                content={
                  <>
                    {t.rich('reward', {
                      lettacoin: () => <LettaCoinIcon />,
                      credits:
                        stepToRewardMap.create_template +
                        stepToRewardMap.explore_ade +
                        stepToRewardMap.save_version +
                        stepToRewardMap.deploy_agent +
                        stepToRewardMap.about_credits,
                    })}
                  </>
                }
              />
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

import Astronaut from './astronaut.webp';
import {
  Badge,
  Button,
  HStack,
  LettaCoinIcon,
  OnboardingCheckbox,
  OnboardingPrimaryDialog,
  OnboardingPrimaryHeading,
  OnboardingRewardElement,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { useCallback } from 'react';
import { useSetOnboardingStep } from '$web/client/hooks/useOnboarding/useSetOnboardingStep/useSetOnboardingStep';
import { stepToRewardMap } from '@letta-cloud/types';
import { usePauseOnboarding } from '$web/client/components/usePauseOnboarding/usePauseOnboarding';

export function StartOnboardingDialog() {
  const t = useTranslations('onboarding/StartOnboardingDialog');

  const { setOnboardingStep, isPending, isSuccess } = useSetOnboardingStep();

  const handleStart = useCallback(() => {
    setOnboardingStep('about_credits');
  }, [setOnboardingStep]);

  const { pauseOnboarding } = usePauseOnboarding();

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
        <Button
          onClick={pauseOnboarding}
          color="tertiary"
          size="large"
          label={t('skip')}
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
        <VStack paddingTop gap="medium">
          <HStack>
            <OnboardingCheckbox label={t('steps.creditsAndCloud')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'about_credits',
              )}
              reward={stepToRewardMap.about_credits}
            />
          </HStack>
          <HStack>
            <OnboardingCheckbox label={t('steps.createATemplate')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'create_template',
              )}
              reward={stepToRewardMap.create_template}
            />
          </HStack>
          <HStack>
            <OnboardingCheckbox label={t('steps.exploreTheADE')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'explore_ade',
              )}
              reward={stepToRewardMap.explore_ade}
            />
          </HStack>
          <HStack>
            <OnboardingCheckbox label={t('steps.saveATemplate')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'save_version',
              )}
              reward={stepToRewardMap.save_version}
            />
          </HStack>
          <HStack>
            <OnboardingCheckbox label={t('steps.deployAnAgent')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'deploy_agent',
              )}
              reward={stepToRewardMap.deploy_agent}
            />
          </HStack>
        </VStack>
      </VStack>
    </OnboardingPrimaryDialog>
  );
}

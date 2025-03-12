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
import { useRouter } from 'next/navigation';

export function StartOnboardingDialog() {
  const t = useTranslations('onboarding/StartOnboardingDialog');

  const { push } = useRouter();

  const { setOnboardingStep, isPending, isSuccess } = useSetOnboardingStep();

  const handleStart = useCallback(() => {
    setOnboardingStep('create_template', () => {
      push('/projects/default-project');
    });
  }, [setOnboardingStep, push]);

  const handleDismiss = useCallback(() => {
    setOnboardingStep('skipped');
  }, [setOnboardingStep]);

  const user = useCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <OnboardingPrimaryDialog
      imageUrl={Astronaut}
      isOpen
      secondaryAction={
        <Button
          onClick={handleDismiss}
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
                    {t.rich('reward', { lettacoin: () => <LettaCoinIcon /> })}
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
            <OnboardingCheckbox label={t('steps.createATemplate')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'create_template',
              )}
              reward={250}
            />
          </HStack>
          <HStack>
            <OnboardingCheckbox label={t('steps.messageASimulatedAgent')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'message_template',
              )}
              reward={250}
            />
          </HStack>
          <HStack>
            <OnboardingCheckbox label={t('steps.editATemplate')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'edit_template',
              )}
              reward={500}
            />
          </HStack>
          <HStack>
            <OnboardingCheckbox label={t('steps.versionATemplate')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'save_version',
              )}
              reward={500}
            />
          </HStack>
          <HStack>
            <OnboardingCheckbox label={t('steps.deployAnAgent')} />
            <OnboardingRewardElement
              isClaimed={user.onboardingStatus?.claimedSteps.includes(
                'deploy_agent',
              )}
              reward={1000}
            />
          </HStack>
        </VStack>
      </VStack>
    </OnboardingPrimaryDialog>
  );
}

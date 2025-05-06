import {
  HStack,
  OnboardingCheckbox,
  OnboardingRewardElement,
  VStack,
} from '@letta-cloud/ui-component-library';
import { stepToRewardMap } from '@letta-cloud/types';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

export function MainOnboardingSteps() {
  const t = useTranslations('onboarding/StartOnboardingDialog');

  const user = useCurrentUser();

  const { data: isModelsPageEnabled } = useFeatureFlag('MODELS_ROOT_PAGE');

  if (!user) {
    return null;
  }

  return (
    <VStack paddingTop gap="medium">
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'about_credits',
          )}
          label={
            isModelsPageEnabled ? t('steps.models') : t('steps.creditsAndCloud')
          }
        />
        <OnboardingRewardElement
          isClaimed={user.onboardingStatus?.claimedSteps.includes(
            'about_credits',
          )}
          reward={stepToRewardMap.about_credits}
        />
      </HStack>
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'create_template',
          )}
          label={t('steps.createATemplate')}
        />
        <OnboardingRewardElement
          isClaimed={user.onboardingStatus?.claimedSteps.includes(
            'create_template',
          )}
          reward={stepToRewardMap.create_template}
        />
      </HStack>
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'explore_ade',
          )}
          label={t('steps.exploreTheADE')}
        />
        <OnboardingRewardElement
          isClaimed={user.onboardingStatus?.claimedSteps.includes(
            'explore_ade',
          )}
          reward={stepToRewardMap.explore_ade}
        />
      </HStack>
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'save_version',
          )}
          label={t('steps.saveATemplate')}
        />
        <OnboardingRewardElement
          isClaimed={user.onboardingStatus?.claimedSteps.includes(
            'save_version',
          )}
          reward={stepToRewardMap.save_version}
        />
      </HStack>
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'deploy_agent',
          )}
          label={t('steps.deployAnAgent')}
        />
        <OnboardingRewardElement
          isClaimed={user.onboardingStatus?.claimedSteps.includes(
            'deploy_agent',
          )}
          reward={stepToRewardMap.deploy_agent}
        />
      </HStack>
    </VStack>
  );
}

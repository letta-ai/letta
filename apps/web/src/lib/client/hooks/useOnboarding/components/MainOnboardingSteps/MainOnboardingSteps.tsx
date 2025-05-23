import {
  HStack,
  OnboardingCheckbox,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';

export function MainOnboardingSteps() {
  const t = useTranslations('onboarding/StartOnboardingDialog');

  const user = useCurrentUser();

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
          label={t('steps.models')}
        />
      </HStack>
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'create_template',
          )}
          label={t('steps.createATemplate')}
        />
      </HStack>
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'explore_ade',
          )}
          label={t('steps.exploreTheADE')}
        />
      </HStack>
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'save_version',
          )}
          label={t('steps.saveATemplate')}
        />
      </HStack>
      <HStack>
        <OnboardingCheckbox
          checked={user.onboardingStatus?.completedSteps.includes(
            'deploy_agent',
          )}
          label={t('steps.deployAnAgent')}
        />
      </HStack>
    </VStack>
  );
}

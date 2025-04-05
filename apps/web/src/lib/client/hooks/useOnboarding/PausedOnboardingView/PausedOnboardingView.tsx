import Astronaut from './small-astronaut.png';
import {
  Button,
  HStack,
  RocketIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import Image from 'next/image';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { MainOnboardingSteps } from '../components/MainOnboardingSteps/MainOnboardingSteps';
import { useUnpauseOnboarding } from '@letta-cloud/sdk-web';

export function PausedOnboardingView() {
  const t = useTranslations('onboarding/PausedOnboardingView');
  const user = useCurrentUser();

  const { unpauseOnboarding } = useUnpauseOnboarding({
    onSuccess: () => {
      if (
        ['explore_ade', 'save_version', 'deploy_agent', 'completed'].includes(
          user?.onboardingStatus?.currentStep || '',
        )
      ) {
        window.location.href = '/any-template';
        return;
      }
    },
  });

  if (!user?.onboardingStatus?.pausedAt) {
    return null;
  }

  return (
    <VStack fullWidth fullHeight color="background-grey" padding>
      <HStack align="center">
        <div className="min-w-[72] max-w-[72px] bg-gray-100 h-full max-h-[72px] min-h-[72px] overflow-hidden">
          <Image
            /* eslint-disable-next-line react/forbid-component-props */
            className="h-[72px]"
            src={Astronaut}
            alt="A spacy guy"
          />
        </div>
        <VStack paddingX="small" gap={false}>
          <Typography variant="heading4">{t('title')}</Typography>
          <Typography>{t('description')}</Typography>
        </VStack>
      </HStack>
      <MainOnboardingSteps />
      <HStack paddingTop="small">
        <Button
          preIcon={<RocketIcon />}
          size="large"
          onClick={() => {
            unpauseOnboarding();
          }}
          label={t('trigger')}
          color="primary"
        />
      </HStack>
    </VStack>
  );
}

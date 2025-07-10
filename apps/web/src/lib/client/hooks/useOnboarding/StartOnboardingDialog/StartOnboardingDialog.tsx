import Astronaut from './astronaut.webp';
import {
  ActionCard,
  Badge,
  Button,
  ConfirmPauseOnboardingDialog,
  HStack,
  LettaLoader,
  OnboardingPrimaryDialog,
  OnboardingPrimaryHeading,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { useCallback, useMemo, useState } from 'react';
import {
  useFeatureFlag,
  usePauseOnboarding,
  useSetOnboardingStep,
  webApi,
} from '@letta-cloud/sdk-web';
import { useRouter } from 'next/navigation';
import { useStartQuickADETour } from '@letta-cloud/ui-ade-components';
import { MainOnboardingSteps } from '$web/client/hooks/useOnboarding/components/MainOnboardingSteps/MainOnboardingSteps';

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

  const startQuickADETour = useStartQuickADETour();

  const {
    mutate,
    isPending: createPending,
    isSuccess: createSuccess,
  } = webApi.starterKits.createAgentFromStarterKit.useMutation();

  const user = useCurrentUser();

  const { pauseOnboarding } = usePauseOnboarding();

  const handleCreateAgent = useCallback(() => {
    mutate(
      {
        params: {
          starterKitId: 'sleepTime',
        },
        body: {},
      },
      {
        onSuccess: (res) => {
          setRedirecting(true);
          startQuickADETour(res.body.agentId);
          pauseOnboarding();

          push(
            `/projects/${res.body.projectSlug}/agents/${res.body.agentId}?message=${encodeURIComponent(`My name is ${user?.name || 'no name'}, please remember that!`)}`,
          );
        },
      },
    );
  }, [mutate, pauseOnboarding, push, startQuickADETour, user?.name]);

  const showLoading = useMemo(() => {
    return (
      isPending || redirecting || isSuccess || createPending || createSuccess
    );
  }, [isPending, isSuccess, redirecting, createPending, createSuccess]);

  const { data: enableQuickOnboarding } = useFeatureFlag('QUICK_ONBOARDING');

  if (!user) {
    return null;
  }

  if (!enableQuickOnboarding) {
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
            description={t('descriptionOld')}
          ></OnboardingPrimaryHeading>
          <MainOnboardingSteps />
        </VStack>
      </OnboardingPrimaryDialog>
    );
  }

  return (
    <OnboardingPrimaryDialog imageUrl={Astronaut} title={t('title')} isOpen>
      <VStack position="relative">
        {showLoading && (
          <div className="absolute w-full h-full fade-in-5 bg-opacity-75 bg-background-grey flex justify-center z-10 items-center">
            <div>
              <LettaLoader size="large" variant="flipper" />
            </div>
          </div>
        )}
        <OnboardingPrimaryHeading
          title={t('title')}
          description={t('description')}
        ></OnboardingPrimaryHeading>
        <VStack paddingY>
          <ActionCard
            title={
              <HStack align="center" as="span">
                {t('deepDive.title')}{' '}
                <Badge
                  variant="chipPremium"
                  border
                  size="small"
                  content={t('deepDive.time')}
                />
              </HStack>
            }
            description={t('deepDive.description')}
            onClick={() => {
              handleStart();
            }}
          />
          <ActionCard
            title={
              <HStack align="center" as="span">
                {t('short.title')}{' '}
                <Badge
                  variant="chipUsageBased"
                  border
                  size="small"
                  content={t('short.time')}
                />
              </HStack>
            }
            description={t('short.description')}
            onClick={() => {
              handleCreateAgent();
            }}
          />
        </VStack>
        <ConfirmPauseOnboardingDialog
          trigger={
            <Button color="tertiary" fullWidth size="large" label={t('skip')} />
          }
        />
      </VStack>
    </OnboardingPrimaryDialog>
  );
}

import Astronaut from './astronaut.webp';
import {
  Button,
  OnboardingPrimaryDialog,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentUser } from '$web/client/hooks';
import { useCallback, useMemo, useTransition } from 'react';
import { usePauseOnboarding, webApi } from '@letta-cloud/sdk-web';
import { useRouter } from 'next/navigation';
import { useStartQuickADETour } from '@letta-cloud/ui-ade-components';
import { GoingToADEView } from '$web/client/components/GoingToADEView/GoingToADEView';
import * as React from 'react';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';
import { ConfirmPauseOnboardingDialog } from '@letta-cloud/ui-ade-components';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

export function StartOnboardingDialog() {
  const t = useTranslations('onboarding/StartOnboardingDialog');

  const { push } = useRouter();
  const startQuickADETour = useStartQuickADETour();

  const showOnboardingFromInit = useShowOnboarding('init');
  const showOnboardingFromRestart = useShowOnboarding('restarted');

  const { mutate, isPending: createPending } =
    webApi.starterKits.createAgentFromStarterKit.useMutation();

  const [isTransitioning, startTransition] = useTransition();
  const user = useCurrentUser();

  const { pauseOnboarding } = usePauseOnboarding();

  const handleCreateAgent = useCallback(() => {
    trackClientSideEvent(AnalyticsEvent.ONBOARDING_NEW_USER, {
      onboarding_type: 'create:new_agent',
    });

    mutate(
      {
        params: {
          starterKitId: 'companion',
        },
        body: {},
      },
      {
        onSuccess: (res) => {
          startQuickADETour(res.body.agentId);
          pauseOnboarding();

          startTransition(() => {
            push(
              `/projects/${res.body.projectSlug}/agents/${res.body.agentId}?message=${encodeURIComponent(`My name is ${user?.name || 'no name'}, please remember that!`)}`,
            );
          });
        },
      },
    );
  }, [mutate, pauseOnboarding, push, startQuickADETour, user]);

  const showLoading = useMemo(() => {
    return createPending || isTransitioning;
  }, [createPending, isTransitioning]);

  const isVisible = useMemo(() => {
    return showOnboardingFromInit || showOnboardingFromRestart;
  }, [showOnboardingFromInit, showOnboardingFromRestart]);

  if (!user) {
    return null;
  }

  return (
    <>
      {showLoading && (
        <GoingToADEView
          mode="agent"
          messages={[
            t('loadingMessages.creatingAgent'),
            t('loadingMessages.goingToAde'),
            t('loadingMessages.sorry'),
          ]}
        />
      )}
      {isVisible && (
        <OnboardingPrimaryDialog
          imageUrl={Astronaut}
          title={t('title')}
          isOpen={!showLoading}
        >
          <VStack position="relative" gap="large">
            <VStack>
              <Typography bold variant="heading4">
                {t('title')}
              </Typography>
              <Typography>{t('description')}</Typography>
              <Typography>{t('description2')}</Typography>
            </VStack>
            <VStack>
              <Button
                color="primary"
                fullWidth
                size="large"
                label={t('start')}
                onClick={handleCreateAgent}
                disabled={showLoading}
              />
              <ConfirmPauseOnboardingDialog
                trigger={
                  <Button
                    color="tertiary"
                    fullWidth
                    size="large"
                    label={t('skip')}
                  />
                }
              />
            </VStack>
          </VStack>
        </OnboardingPrimaryDialog>
      )}
    </>
  );
}

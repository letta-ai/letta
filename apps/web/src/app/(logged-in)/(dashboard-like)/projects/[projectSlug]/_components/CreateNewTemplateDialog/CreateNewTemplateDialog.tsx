import React, { useCallback } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { webApi, webApiQueryKeys } from '$web/client';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Dialog,
  LoadingEmptyStatusComponent,
  OnboardingAsideFocus,
  Section,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser, useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { Slot } from '@radix-ui/react-slot';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';
import {
  stepToRewardMap,
  TOTAL_PRIMARY_ONBOARDING_STEPS,
} from '@letta-cloud/types';
import { useSetOnboardingStep } from '@letta-cloud/sdk-web';
import {
  StarterKitSelector,
  useADETourStep,
} from '@letta-cloud/ui-ade-components';

interface CreateNewTemplateDialogProps {
  trigger: React.ReactNode;
}

interface OnboardingWrapperProps {
  children: React.ReactNode;
}

function OnboardingWrapper(props: OnboardingWrapperProps) {
  const { children } = props;
  const t = useTranslations(
    'projects/(projectSlug)/components/CreateNewTemplateDialog',
  );

  const show = useShowOnboarding('create_template');

  return (
    <OnboardingAsideFocus
      spotlight
      reward={stepToRewardMap.create_template}
      totalSteps={TOTAL_PRIMARY_ONBOARDING_STEPS}
      currentStep={2}
      title={t('OnboardingWrapper.title')}
      description={t('OnboardingWrapper.description')}
      placement="left-start"
      isOpen={show}
    >
      {children}
    </OnboardingAsideFocus>
  );
}

export function CreateNewTemplateDialog(props: CreateNewTemplateDialogProps) {
  const { trigger } = props;
  const t = useTranslations(
    'projects/(projectSlug)/components/CreateNewTemplateDialog',
  );
  const { slug, id: projectId } = useCurrentProject();

  const { push } = useRouter();

  const [_, setStep] = useADETourStep();

  const user = useCurrentUser();
  const { mutate, isPending, isSuccess, isError } =
    webApi.starterKits.createTemplateFromStarterKit.useMutation();

  const { setOnboardingStep } = useSetOnboardingStep();

  const [open, setOpen] = React.useState(false);

  const queryClient = useQueryClient();

  const handleSelectStarterKit = useCallback(
    (starterKitId: string) => {
      if (user?.onboardingStatus?.currentStep === 'create_template') {
        setStep('welcome');
        setOnboardingStep({
          onboardingStep: 'explore_ade',
          stepToClaim: 'create_template',
        });
      }

      mutate(
        {
          params: {
            starterKitId,
          },
          body: {
            projectId: projectId,
          },
        },
        {
          onSuccess: (data) => {
            void queryClient.invalidateQueries({
              queryKey: webApiQueryKeys.agentTemplates.listAgentTemplates,
              exact: false,
            });

            push(`/projects/${slug}/templates/${data.body.templateName}`);
          },
        },
      );
    },
    [
      mutate,
      setOnboardingStep,
      user?.onboardingStatus?.currentStep,
      queryClient,
      push,
      slug,
      setStep,
      projectId,
    ],
  );

  const [canCreateTemplate] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  if (!canCreateTemplate) {
    return null;
  }

  return (
    <Dialog
      title={t('title')}
      trigger={
        <OnboardingWrapper>
          <Slot
            data-testid="create-agent-template-button"
            onClick={() => {
              setOpen(true);
            }}
          >
            {trigger}
          </Slot>
        </OnboardingWrapper>
      }
      hideFooter
      disableForm
      size="xxlarge"
      isOpen={open}
      onOpenChange={setOpen}
    >
      <Section
        title={t('starterKits.title')}
        description={t('starterKits.description')}
      >
        <VStack paddingBottom>
          {isSuccess || isPending ? (
            <LoadingEmptyStatusComponent
              emptyMessage=""
              isLoading
              loadingMessage={t('loading')}
            />
          ) : (
            <VStack>
              {isError && <Alert title={t('error')} />}
              <StarterKitSelector
                starterKitsToExclude={['sleepTime']}
                onSelectStarterKit={(_, kit) => {
                  handleSelectStarterKit(kit.id);
                }}
              />
            </VStack>
          )}
        </VStack>
      </Section>
    </Dialog>
  );
}

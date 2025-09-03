import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { webApi } from '$web/client';
import { usePathname, useRouter } from 'next/navigation';
import {
  Alert,
  BillingLink,
  Dialog,
  Section,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useQueryClient } from '@tanstack/react-query';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { Slot } from '@radix-ui/react-slot';
import { useShowOnboarding } from '$web/client/hooks/useShowOnboarding/useShowOnboarding';
import { TOTAL_PRIMARY_ONBOARDING_STEPS } from '@letta-cloud/types';
import { StarterKitSelector } from '@letta-cloud/ui-ade-components';
import { isAPIError } from '@letta-cloud/sdk-core';
import { OnboardingAsideFocus } from '@letta-cloud/ui-ade-components';
import { cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { GoingToADEView } from '$web/client/components/GoingToADEView/GoingToADEView';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

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

  const { mutate, isPending, isSuccess, error } =
    webApi.starterKits.createTemplateFromStarterKit.useMutation();

  const [open, setOpen] = React.useState(false);

  const pathname = usePathname();

  const queryClient = useQueryClient();

  const handleSelectStarterKit = useCallback(
    (starterKitId: string) => {
      const originalPathName = pathname;
      const name = uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        length: 3,
        separator: '-',
      });

      push(`/projects/${slug}/templates/${name}?ensure=true`);

      mutate(
        {
          params: {
            starterKitId,
          },
          body: {
            name,
            projectId: projectId,
          },
        },
        {
          onError: () => {
            push(originalPathName);
          },
          onSuccess: (data) => {
            void queryClient.invalidateQueries({
              queryKey: cloudQueryKeys.templates.listTemplates,
              exact: false,
            });

            push(`/projects/${slug}/templates/${data.body.templateName}`);
          },
        },
      );
    },
    [mutate, push, projectId, queryClient, slug, pathname],
  );

  const errorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error) && error.status === 402) {
        return t.rich('errors.overage', {
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        });
      }

      return t('errors.default');
    }

    return undefined;
  }, [error, t]);

  const { data: enabledSleeptimeTemplates } = useFeatureFlag(
    'SLEEPTIME_TEMPLATES',
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
          {isSuccess || isPending ? <GoingToADEView mode="template" /> : null}
          <VStack>
            {errorMessage && <Alert title={errorMessage} />}
            <StarterKitSelector
              architectures={[
                'memgpt',
                ...(enabledSleeptimeTemplates ? ['sleeptime' as const] : []),
              ]}
              onSelectStarterKit={(_, kit) => {
                handleSelectStarterKit(kit.id);
              }}
            />
          </VStack>
        </VStack>
      </Section>
    </Dialog>
  );
}

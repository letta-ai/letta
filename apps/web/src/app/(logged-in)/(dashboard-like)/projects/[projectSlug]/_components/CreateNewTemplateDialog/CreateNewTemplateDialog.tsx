import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { webApi, webApiQueryKeys } from '$web/client';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Dialog,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  Section,
  StarterKitItems,
  VStack,
} from '@letta-cloud/ui-component-library';
import { STARTER_KITS } from '@letta-cloud/config-agent-starter-kits';
import { useQueryClient } from '@tanstack/react-query';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { Slot } from '@radix-ui/react-slot';
import { PrimaryOnboardingAsideFocus } from '$web/client/components/PrimaryOnboardingAsideFocus/PrimaryOnboardingAsideFocus';

interface CreateNewTemplateDialogProps {
  trigger: React.ReactNode;
}

export function CreateNewTemplateDialog(props: CreateNewTemplateDialogProps) {
  const { trigger } = props;
  const t = useTranslations(
    'projects/(projectSlug)/components/CreateNewTemplateDialog',
  );
  const { slug, id: projectId } = useCurrentProject();

  const starterKits = useMemo(() => {
    return Object.entries(STARTER_KITS);
  }, []);

  const { push } = useRouter();

  const { mutate, isPending, isSuccess, isError } =
    webApi.starterKits.createTemplateFromStarterKit.useMutation();

  const [open, setOpen] = React.useState(false);

  const queryClient = useQueryClient();

  const handleSelectStarterKit = useCallback(
    (starterKitId: string) => {
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
    [mutate, queryClient, push, slug, projectId],
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
        <PrimaryOnboardingAsideFocus step="create_template">
          <Slot
            data-testid="create-agent-template-button"
            onClick={() => {
              setOpen(true);
            }}
          >
            {trigger}
          </Slot>
        </PrimaryOnboardingAsideFocus>
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
              <NiceGridDisplay itemWidth="250px" itemHeight="260px">
                {starterKits.map(([id, starterKit]) => {
                  return (
                    <StarterKitItems
                      onSelectStarterKit={() => {
                        handleSelectStarterKit(starterKit.id);
                      }}
                      key={id}
                      starterKit={starterKit}
                    />
                  );
                })}
              </NiceGridDisplay>
            </VStack>
          )}
        </VStack>
      </Section>
    </Dialog>
  );
}

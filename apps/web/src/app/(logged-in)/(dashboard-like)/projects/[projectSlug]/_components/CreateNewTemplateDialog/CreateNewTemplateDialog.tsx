import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '../../hooks';
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
} from '@letta-cloud/component-library';
import { STARTER_KITS } from '@letta-cloud/agent-starter-kits';
import { useQueryClient } from '@tanstack/react-query';

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

  return (
    <Dialog
      title={t('title')}
      trigger={trigger}
      hideFooter
      disableForm
      size="xxlarge"
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
                {starterKits.map(([id, starterKit]) => (
                  <StarterKitItems
                    onSelectStarterKit={() => {
                      handleSelectStarterKit(starterKit.id);
                    }}
                    key={id}
                    starterKit={starterKit}
                  />
                ))}
              </NiceGridDisplay>
            </VStack>
          )}
        </VStack>
      </Section>
    </Dialog>
  );
}

import React, { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useCurrentProject } from '../../hooks';
import { STARTER_KITS, webOriginSDKApi } from '$web/client';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Dialog,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  Section,
  VStack,
} from '@letta-web/component-library';
import { StarterKitItems } from '$web/client/components';

interface CreateNewTemplateDialogProps {
  trigger: React.ReactNode;
}

export function CreateNewTemplateDialog(props: CreateNewTemplateDialogProps) {
  const { trigger } = props;
  const t = useTranslations(
    'projects/(projectSlug)/components/CreateNewTemplateDialog'
  );
  const { id: projectId, slug } = useCurrentProject();

  const starterKits = useMemo(() => {
    return Object.entries(STARTER_KITS);
  }, []);

  const { push } = useRouter();

  const { mutate, isPending, isSuccess, isError } =
    webOriginSDKApi.agents.createAgent.useMutation();

  const handleSelectStarterKit = useCallback(
    (starterKitId: string) => {
      mutate(
        {
          body: {
            template: true,
            from_template: starterKitId,
            project_id: projectId,
          },
        },
        {
          onSuccess: (data) => {
            push(`/projects/${slug}/templates/${data.body.name}`);
          },
        }
      );
    },
    [mutate, projectId, push, slug]
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

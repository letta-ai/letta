import {
  Alert,
  Button,
  Dialog,
  Form,
  FormField,
  FormProvider,
  LoadingEmptyStatusComponent,
  Spinner,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AgentFileAccessLevels } from '@letta-cloud/types';
import { useCallback } from 'react';
import type { ServerInferResponses } from '@ts-rest/core';
import type { webApiContracts } from '@letta-cloud/sdk-web';
import { UpdateAccessLevelForm } from './UpdateAccessLevelForm/UpdateAccessLevelForm';
import {
  AccessLevelSelect,
  type AccessLevelValue,
} from './AccessLevelSelect/AccessLevelSelect';

const CreateAgentFileMetadataSchema = z.object({
  accessLevel: AgentFileAccessLevels,
});

type CreateAgentFileMetadataType = z.infer<
  typeof CreateAgentFileMetadataSchema
>;

function LoadingView() {
  const t = useTranslations(
    'AgentPage/PublishAgentFileSettingsDialog.LoadingView',
  );

  return <LoadingEmptyStatusComponent loadingMessage={t('text')} isLoading />;
}

function NotPublishedView({ agentId }: { agentId: string }) {
  const t = useTranslations(
    'AgentPage/PublishAgentFileSettingsDialog.NotPublishedView',
  );
  const queryClient = useQueryClient();

  const form = useForm<CreateAgentFileMetadataType>({
    resolver: zodResolver(CreateAgentFileMetadataSchema),
    defaultValues: {
      accessLevel: 'organization',
    },
  });

  const { mutate, isPending, isError } =
    webApi.agentfile.createAgentfileMetadata.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          ServerInferResponses<
            typeof webApiContracts.agentfile.getAgentfileMetadata
          >
        >(
          {
            queryKey: webApiQueryKeys.agentfile.getAgentfileMetadata(agentId),
          },
          () => ({
            status: 200,
            body: response.body,
          }),
        );
      },
    });

  const handleSubmit = useCallback(
    (data: CreateAgentFileMetadataType) => {
      mutate({
        params: { agentId },
        body: data,
      });
    },
    [mutate, agentId],
  );
  return (
    <VStack paddingBottom gap="form">
      <Alert variant="warning" title={t('description')} />

      <FormProvider {...form}>
        <Form onSubmit={form.handleSubmit(handleSubmit)}>
          <VStack gap="form">
            {isError && <Alert title={t('error')} variant="destructive" />}

            <FormField
              name="accessLevel"
              render={({ field }) => (
                <AccessLevelSelect
                  value={field.value as AccessLevelValue}
                  onChange={field.onChange}
                  description={(() => {
                    if (field.value === 'public') {
                      return t('accessLevelDetails.public');
                    }

                    if (field.value === 'organization') {
                      return t('accessLevelDetails.organization');
                    }

                    return t('accessLevelDetails.loggedIn');
                  })()}
                  rightOfLabelContent={
                    isPending ? <Spinner size="xsmall" /> : null
                  }
                  label={t('accessLevel.label')}
                />
              )}
            />

            <Button
              type="submit"
              fullWidth
              busy={isPending}
              disabled={isPending}
              label={t('publish')}
              color="primary"
            />
          </VStack>
        </Form>
      </FormProvider>
    </VStack>
  );
}

function PublishedView({
  agentId,
  accessLevel,
}: {
  agentId: string;
  accessLevel: string;
}) {
  const t = useTranslations(
    'AgentPage/PublishAgentFileSettingsDialog.PublishedView',
  );

  return (
    <VStack paddingBottom gap="form">
      <Alert variant="info" title={t('description')} />

      <UpdateAccessLevelForm
        agentId={agentId}
        currentAccessLevel={accessLevel as AccessLevelValue}
        autoSave={true}
      />
    </VStack>
  );
}

interface PublishAgentFileSettingsDialogProps {
  trigger: React.ReactNode;
  agentId: string;
  agentName: string;
}

export function PublishAgentFileSettingsDialog(
  props: PublishAgentFileSettingsDialogProps,
) {
  const { trigger, agentId } = props;
  const t = useTranslations('AgentPage/PublishAgentFileSettingsDialog');

  const { data, isLoading } = webApi.agentfile.getAgentfileMetadata.useQuery({
    queryKey: webApiQueryKeys.agentfile.getAgentfileMetadata(agentId),
    queryData: {
      params: { agentId },
    },
    retry: 0,
  });

  return (
    <Dialog
      headerVariant="emphasis"
      trigger={trigger}
      disableForm
      hideFooter
      title={t('title')}
    >
      {isLoading && <LoadingView />}
      {!isLoading && !data && <NotPublishedView agentId={agentId} />}
      {!isLoading && data && (
        <PublishedView agentId={agentId} accessLevel={data.body.accessLevel} />
      )}
    </Dialog>
  );
}

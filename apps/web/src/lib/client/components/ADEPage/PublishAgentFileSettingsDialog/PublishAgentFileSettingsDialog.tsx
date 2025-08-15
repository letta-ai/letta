import {
  Alert,
  Button,
  Dialog,
  Form,
  FormField,
  FormProvider,
  Input,
  Link,
  LoadingEmptyStatusComponent,
  Spinner,
  TextArea,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import {
  type GetAgentFileMetadataType,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
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
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import { environment } from '@letta-cloud/config-environment-variables';

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

  const { name, description } = useCurrentAgent();
  const queryClient = useQueryClient();

  const CreateAgentFileMetadataSchema = z.object({
    accessLevel: AgentFileAccessLevels,
    name: z
      .string()
      .min(1, {
        message: t('validation.nameRequired'),
      })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: t('validation.nameRegex'),
      })
      .max(25, {
        message: t('validation.nameMaxLength'),
      }),
    summary: z
      .string()
      .min(1, {
        message: t('validation.summaryRequired'),
      })
      .max(200, {
        message: t('validation.summaryMaxLength'),
      }),
    description: z
      .string()
      .min(1, {
        message: t('validation.descriptionRequired'),
      })
      .max(50000, {
        message: t('validation.descriptionTooLong'),
      }),
  });

  type CreateAgentFileMetadataType = z.infer<
    typeof CreateAgentFileMetadataSchema
  >;

  function transformNameToAlphaNumeric(name: string) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  const form = useForm<CreateAgentFileMetadataType>({
    resolver: zodResolver(CreateAgentFileMetadataSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      accessLevel: 'organization',
      name: transformNameToAlphaNumeric(name) || 'default',
      description: description || '',
      summary: '',
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
                      return t.rich('accessLevelDetails.public', {
                        link: (chunks) => (
                          <Link
                            target="_blank"
                            href={environment.NEXT_PUBLIC_AGENTFILES_SITE}
                          >
                            {chunks}
                          </Link>
                        ),
                      });
                    }

                    if (field.value === 'organization') {
                      return t('accessLevelDetails.organization');
                    }

                    if (field.value === 'unlisted') {
                      return t('accessLevelDetails.unlisted');
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
            <FormField
              name="name"
              render={({ field }) => (
                <Input
                  label={t('name.label')}
                  placeholder={t('name.placeholder')}
                  description={t('name.description')}
                  fullWidth
                  {...field}
                />
              )}
            />

            <FormField
              name="summary"
              render={({ field }) => (
                <TextArea
                  autosize
                  minRows={2}
                  maxRows={2}
                  label={t('summary.label')}
                  placeholder={t('summary.placeholder')}
                  description={t('summary.description')}
                  fullWidth
                  rightOfLabelContent={
                    <Typography
                      variant="body4"
                      color={
                        field.value?.length >= 200 ? 'destructive' : 'muted'
                      }
                    >
                      {field.value?.length || 0}/200
                    </Typography>
                  }
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 200) {
                      field.onChange(e);
                    }
                  }}
                  maxLength={200}
                />
              )}
            />

            <FormField
              name="description"
              render={({ field, fieldState }) => (
                <TextArea
                  autosize
                  minRows={5}
                  maxRows={10}
                  label={t('description.label')}
                  placeholder={t('description.placeholder')}
                  description={t('description.description')}
                  fullWidth
                  rightOfLabelContent={
                    fieldState.error && (
                      <Typography variant="body4" color="destructive">
                        {fieldState.error.message}
                      </Typography>
                    )
                  }
                  {...field}
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

interface PublishedViewProps {
  agentId: string;
  metadata: GetAgentFileMetadataType;
}

function PublishedView(props: PublishedViewProps) {
  const { agentId, metadata } = props;
  return (
    <VStack paddingBottom gap="form">
      <UpdateAccessLevelForm agentId={agentId} metadata={metadata} />
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
      trigger={trigger}
      disableForm
      size="medium"
      hideFooter
      title={t('title')}
    >
      {isLoading && <LoadingView />}
      {!isLoading && !data && <NotPublishedView agentId={agentId} />}
      {!isLoading && data && (
        <PublishedView agentId={agentId} metadata={data.body} />
      )}
    </Dialog>
  );
}

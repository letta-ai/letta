import {
  Button,
  CopyButton,
  Form,
  FormField,
  FormProvider,
  HStack,
  Input,
  Spinner,
  TextArea,
  toast,
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
import { useCallback } from 'react';
import { environment } from '@letta-cloud/config-environment-variables';
import { AccessLevelSelect } from '../AccessLevelSelect/AccessLevelSelect';
import { AgentFileAccessLevels } from '@letta-cloud/types';

interface UpdateAccessLevelFormProps {
  agentId: string;
  metadata: GetAgentFileMetadataType;
}

export function UpdateAccessLevelForm(props: UpdateAccessLevelFormProps) {
  const { agentId, metadata } = props;
  const t = useTranslations('AgentPage/PublishAgentFileSettingsDialog');
  const queryClient = useQueryClient();

  const UpdateAccessLevelSchema = z.object({
    accessLevel: AgentFileAccessLevels,
    name: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: t('validation.nameRegex'),
      })
      .min(1, {
        message: t('validation.nameRequired'),
      })
      .max(25, {
        message: t('validation.nameMaxLength'),
      }),
    description: z
      .string()
      .min(1, {
        message: t('validation.descriptionRequired'),
      })
      .max(200, {
        message: t('validation.descriptionMaxLength'),
      }),
  });

  type UpdateAccessLevelType = z.infer<typeof UpdateAccessLevelSchema>;

  const form = useForm<UpdateAccessLevelType>({
    resolver: zodResolver(UpdateAccessLevelSchema),
    defaultValues: {
      accessLevel: metadata.accessLevel,
      name: metadata.name,
      description: metadata.description,
    },
  });

  const { mutate, isPending } =
    webApi.agentfile.updateAgentfileAccessLevel.useMutation({
      onSuccess: () => {
        // Invalidate the metadata query to refetch
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.agentfile.getAgentfileMetadata(agentId),
        });
      },
    });

  const handleSubmit = useCallback(
    (data: UpdateAccessLevelType) => {
      mutate(
        {
          params: { agentId },
          body: data,
        },
        {
          onSuccess: () => {
            toast.success(t('UpdateAccessLevelForm.success'));
          },
          onError: () => {
            toast.error(t('UpdateAccessLevelForm.error'));
          },
        },
      );
    },
    [mutate, agentId, t],
  );

  const accessLevel = form.watch('accessLevel');

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleSubmit)}>
        <VStack gap="form">
          <FormField
            name="accessLevel"
            render={({ field }) => (
              <AccessLevelSelect
                value={field.value}
                onChange={field.onChange}
                rightOfLabelContent={
                  isPending ? <Spinner size="xsmall" /> : null
                }
                label={t('UpdateAccessLevelForm.accessLevel.label')}
                description={t('UpdateAccessLevelForm.accessLevel.description')}
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
            name="description"
            render={({ field }) => (
              <TextArea
                autosize
                minRows={2}
                maxRows={3}
                label={t('description.label')}
                placeholder={t('description.placeholder')}
                description={t('description.description')}
                fullWidth
                {...field}
              />
            )}
          />

          <VStack gap="medium">
            <Button
              type="submit"
              busy={isPending}
              disabled={!form.formState.isDirty}
              fullWidth
              label={t('UpdateAccessLevelForm.update')}
              color="primary"
            />
            <HStack>
              {accessLevel === 'public' && (
                <Button
                  color="secondary"
                  target="_blank"
                  label={t('UpdateAccessLevelForm.viewLink')}
                  href={`${environment.NEXT_PUBLIC_AGENTFILES_SITE}/agents/${agentId}`}
                />
              )}
              <CopyButton
                color={accessLevel === 'public' ? 'secondary' : 'tertiary'}
                fullWidth
                copyButtonText={t('UpdateAccessLevelForm.copyLink')}
                textToCopy={`${environment.NEXT_PUBLIC_CURRENT_HOST}/agentfiles/${agentId}`}
              />
            </HStack>
          </VStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

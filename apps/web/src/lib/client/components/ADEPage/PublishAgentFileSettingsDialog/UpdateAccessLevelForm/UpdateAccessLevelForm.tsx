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
  Typography,
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
      .min(1, {
        message: t('validation.nameRequired'),
      })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: t('validation.nameRegex'),
      })
      .max(25, {
        message: t('validation.nameMaxLength'),
      }),
    description: z
      .string()
      .min(1, {
        message: t('validation.descriptionRequired'),
      })
      .max(50000, {
        message: t('validation.descriptionTooLong'),
      }),
    summary: z
      .string()
      .min(1, {
        message: t('validation.summaryRequired'),
      })
      .max(200, {
        message: t('validation.summaryMaxLength'),
      }),
  });

  type UpdateAccessLevelType = z.infer<typeof UpdateAccessLevelSchema>;

  const form = useForm<UpdateAccessLevelType>({
    resolver: zodResolver(UpdateAccessLevelSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      accessLevel: metadata.accessLevel,
      name: metadata.name,
      description: metadata.description,
      summary: metadata.summary,
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
                    color={field.value?.length >= 200 ? 'destructive' : 'muted'}
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
            render={({ field }) => (
              <TextArea
                autosize
                minRows={5}
                maxRows={10}
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

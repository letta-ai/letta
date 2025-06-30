import {
  Button,
  CopyButton,
  Form,
  FormField,
  FormProvider,
  Spinner,
  toast,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCallback, useEffect } from 'react';
import { environment } from '@letta-cloud/config-environment-variables';
import {
  AccessLevelSelect,
  type AccessLevelValue,
} from '../AccessLevelSelect/AccessLevelSelect';

const UpdateAccessLevelSchema = z.object({
  accessLevel: z.enum(['organization', 'logged-in', 'public']),
});

type UpdateAccessLevelType = z.infer<typeof UpdateAccessLevelSchema>;

interface UpdateAccessLevelFormProps {
  /** The agent ID for which to update the access level */
  agentId: string;
  /** The current access level value */
  currentAccessLevel: AccessLevelValue;
  /** Optional callback function called when the update is successful */
  onSuccess?: () => void;
  /** Whether to automatically save changes with debouncing (default: false) */
  autoSave?: boolean;
}

export function UpdateAccessLevelForm(props: UpdateAccessLevelFormProps) {
  const { agentId, currentAccessLevel, onSuccess } = props;
  const t = useTranslations('AgentPage/PublishAgentFileSettingsDialog');
  const queryClient = useQueryClient();

  const form = useForm<UpdateAccessLevelType>({
    resolver: zodResolver(UpdateAccessLevelSchema),
    defaultValues: {
      accessLevel: currentAccessLevel,
    },
  });

  const { mutate, isPending } =
    webApi.agentfile.updateAgentfileAccessLevel.useMutation({
      onSuccess: () => {
        // Invalidate the metadata query to refetch
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.agentfile.getAgentfileMetadata(agentId),
        });
        onSuccess?.();
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

  // Reset form when currentAccessLevel changes
  useEffect(() => {
    form.reset({ accessLevel: currentAccessLevel });
  }, [currentAccessLevel, form]);

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

          <VStack gap="medium">
            <Button
              type="submit"
              busy={isPending}
              disabled={!form.formState.isDirty}
              fullWidth
              label={t('UpdateAccessLevelForm.update')}
              color="primary"
            />
            <CopyButton
              color="tertiary"
              fullWidth
              copyButtonText={t('UpdateAccessLevelForm.copyLink')}
              textToCopy={`${environment.NEXT_PUBLIC_CURRENT_HOST}/agentfiles/${agentId}`}
            />
          </VStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

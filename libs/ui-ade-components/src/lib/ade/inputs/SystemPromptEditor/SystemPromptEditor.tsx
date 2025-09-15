import { z } from 'zod';
import {
  type AgentState,
  useAgentsServiceModifyAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentAgent } from '../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Dialog,
  FormField,
  FormProvider,
  HStack,
  RawInputContainer,
  TextArea,
  Tooltip,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useADEPermissions } from '../../../hooks/useADEPermissions/useADEPermissions';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { useCallback, useState } from 'react';

const systemPromptEditorForm = z.object({
  system: z.string(),
});

type SystemPromptEditorFormType = z.infer<typeof systemPromptEditorForm>;

interface SystemPromptEditorDialogProps {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  system: string;
}

function SystemPromptEditorDialog(props: SystemPromptEditorDialogProps) {
  const { isExpanded, setIsExpanded, system } = props;
  const { mutate, isPending, isError } = useAgentsServiceModifyAgent();
  const queryClient = useQueryClient();
  const currentAgent = useCurrentAgent();
  const t = useTranslations('ADE/AgentSettingsPanel');
  const form = useForm<SystemPromptEditorFormType>({
    resolver: zodResolver(systemPromptEditorForm),
    defaultValues: {
      system,
    },
  });

  const [canUpdateAgent] = useADEPermissions(ApplicationServices.UPDATE_AGENT);

  const handleSubmit = useCallback(
    (data: SystemPromptEditorFormType) => {
      mutate(
        {
          agentId: currentAgent.id,
          requestBody: {
            system: data.system,
          },
        },
        {
          onSuccess: (_r) => {
            queryClient.setQueriesData<AgentState | undefined>(
              {
                queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                  agentId: currentAgent.id,
                }),
              },
              (oldData) => {
                if (!oldData) {
                  return oldData;
                }

                return {
                  ...oldData,
                  system: data.system,
                };
              },
            );
            setIsExpanded(false);
          },
        },
      );
    },
    [currentAgent.id, mutate, queryClient, setIsExpanded],
  );

  return (
    <FormProvider {...form}>
      <Dialog
        size="full"
        isOpen={isExpanded}
        isConfirmBusy={isPending}
        confirmText={t('SystemPromptEditor.dialog.save')}
        onSubmit={form.handleSubmit(handleSubmit)}
        onOpenChange={setIsExpanded}
        disableSubmit={!canUpdateAgent}
        hideFooter={!canUpdateAgent}
        errorMessage={isError ? t('SystemPromptEditor.error') : ''}
        title={t('SystemPromptEditor.dialog.title')}
      >
        <VStack collapseHeight flex gap="form">
          <FormField
            render={({ field }) => {
              return (
                <VStack fullHeight>
                  <HStack gap="xlarge" align="center" justify="spaceBetween">
                    <div>
                      <Alert
                        title={t('SystemPromptEditor.dialog.info')}
                        variant="info"
                      />
                    </div>
                    <Typography
                      noWrap
                      font="mono"
                      color="muted"
                      variant="body2"
                    >
                      {t('SystemPromptEditor.dialog.characterCount', {
                        count: field.value.length,
                      })}
                    </Typography>
                  </HStack>
                  <TextArea
                    fullWidth
                    flex
                    fullHeight
                    disabled={!canUpdateAgent}
                    autosize={false}
                    hideLabel
                    label={t('SystemPromptEditor.label')}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                    }}
                    value={field.value}
                  />
                </VStack>
              );
            }}
            name="system"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

export function SystemPromptEditor() {
  const t = useTranslations('ADE/AgentSettingsPanel');
  const [isExpanded, setIsExpanded] = useState(false);

  const currentAgent = useCurrentAgent();

  return (
    <>
      {isExpanded && (
        <SystemPromptEditorDialog
          system={currentAgent.system || ''}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
        />
      )}
      <RawInputContainer
        fullWidth
        infoTooltip={{
          text: t('SystemPromptEditor.tooltip'),
        }}
        label={t('SystemPromptEditor.label')}
      >
        <Tooltip asChild content={t('SystemPromptEditor.trigger')}>
          <HStack
            fullWidth
            as="button"
            onClick={() => {
              setIsExpanded(true);
            }}
            padding="xsmall"
            gap="small"
            className="border rounded-[2px] bg-background-grey2 dark:bg-card-background border-background-grey2-border dark:border-background-grey3-border"
          >
              <Typography
                noWrap
                color="lighter"
                variant="body4"
                className="whitespace-pre-wrap line-clamp-2 text-left"
              >
                {currentAgent.system}
              </Typography>
            </HStack>
        </Tooltip>
      </RawInputContainer>
    </>
  );
}

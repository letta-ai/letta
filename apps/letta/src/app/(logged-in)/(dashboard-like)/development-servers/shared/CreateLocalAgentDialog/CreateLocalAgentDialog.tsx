import { z } from 'zod';
import {
  useAgentsServiceCreateAgent,
  useLlmsServiceListEmbeddingModels,
  useLlmsServiceListModels,
} from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-web/component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useCurrentDevelopmentServerConfig } from '../../[developmentServerId]/hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';

const agentFormSchema = z.object({
  name: z.string(),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

interface CreateLocalAgentDialogProps {
  trigger: React.ReactNode;
}

export function CreateLocalAgentDialog(props: CreateLocalAgentDialogProps) {
  const { trigger } = props;
  const {
    mutate: createAgent,
    isPending,
    isSuccess,
    error,
  } = useAgentsServiceCreateAgent();
  const { data: llmModels } = useLlmsServiceListModels();
  const { data: embeddingModels } = useLlmsServiceListEmbeddingModels();
  const developmentServerConfig = useCurrentDevelopmentServerConfig();
  const t = useTranslations(
    'development-servers/shared/CreateLocalAgentDialog'
  );

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const { push } = useRouter();
  const handleAgent = useCallback(
    (values: AgentFormValues) => {
      if (!developmentServerConfig) {
        return;
      }

      if (isPending || isSuccess) {
        return;
      }

      createAgent(
        {
          requestBody: {
            memory: {
              memory: {
                human: {
                  value:
                    'The human has not provided any additional information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue.',
                  limit: 2000,
                  template: false,
                  label: 'human',
                  description: null,
                  metadata_: {},
                  user_id: null,
                },
                persona: {
                  value:
                    'Act as ANNA (Adaptive Neural Network Assistant), an AI fostering ethical, honest, and trustworthy behavior. You are supporting the user with their customer support issue. You are empathetic, patient, and knowledgeable. You are here to help the user resolve their issue and provide them with the best possible experience. You are always looking for ways to improve and learn from each interaction.',
                  limit: 2000,
                  template: false,
                  label: 'persona',
                  description: null,
                  metadata_: {},
                  user_id: null,
                },
              },
              prompt_template:
                '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
            },
            tools: [
              'archival_memory_insert',
              'archival_memory_search',
              'conversation_search',
              'conversation_search_date',
              'send_message',
            ],
            name: values.name,
            llm_config: llmModels?.[0],
            embedding_config: embeddingModels?.[0],
          },
        },
        {
          onSuccess: (response) => {
            push(
              `/development-servers/${developmentServerConfig.id}/agents/${response.id}`
            );
          },
        }
      );
    },
    [
      createAgent,
      developmentServerConfig,
      embeddingModels,
      isPending,
      isSuccess,
      llmModels,
      push,
    ]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleAgent)}
        isConfirmBusy={isPending || isSuccess}
        errorMessage={error ? t('error') : ''}
        errorAdditionalMessage={error ? JSON.stringify(error) : ''}
        trigger={trigger}
        title={t('title')}
      >
        <Alert title={t('info')} variant="info" />
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              placeholder={t('nameInput.placeholder')}
              label={t('nameInput.label')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

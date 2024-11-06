'use client';
import {
  Alert,
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  DataTable,
  Dialog,
  FormField,
  FormProvider,
  Input,
  useForm,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import type { AgentState } from '@letta-web/letta-agents-api';
import {
  useLlmsServiceListEmbeddingModels,
  useLlmsServiceListModels,
} from '@letta-web/letta-agents-api';
import { useAgentsServiceCreateAgent } from '@letta-web/letta-agents-api';
import { useAgentsServiceListAgents } from '@letta-web/letta-agents-api';
import { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

const agentFormSchema = z.object({
  name: z.string(),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

function CreateAgentDialog() {
  const {
    mutate: createAgent,
    isPending,
    error,
  } = useAgentsServiceCreateAgent();
  const { data: llmModels } = useLlmsServiceListModels();
  const { data: embeddingModels } = useLlmsServiceListEmbeddingModels();

  const t = useTranslations('local-project/page');

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const { push } = useRouter();
  const handleAgent = useCallback(
    (values: AgentFormValues) => {
      if (isPending) {
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
                  template_name: 'customer',
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
                  template_name: 'persona',
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
              'pause_heartbeats',
              'send_message',
            ],
            name: values.name,
            llm_config: llmModels?.[0],
            embedding_config: embeddingModels?.[0],
          },
        },
        {
          onSuccess: (response) => {
            push(`/local-project/agents/${response.id}`);
          },
        }
      );
    },
    [createAgent, embeddingModels, isPending, llmModels, push]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        onSubmit={form.handleSubmit(handleAgent)}
        isConfirmBusy={isPending}
        errorMessage={error ? t('CreateAgentDialog.error') : ''}
        errorAdditionalMessage={error ? JSON.stringify(error) : ''}
        trigger={<Button label={t('createAgent')} />}
        title={t('CreateAgentDialog.title')}
      >
        <Alert title={t('CreateAgentDialog.info')} variant="info" />
        <FormField
          name="name"
          render={({ field }) => (
            <Input
              fullWidth
              placeholder={t('CreateAgentDialog.nameInput.placeholder')}
              label={t('CreateAgentDialog.nameInput.label')}
              {...field}
            />
          )}
        />
      </Dialog>
    </FormProvider>
  );
}

const LIMIT = 10;

function LocalProjectPage() {
  const t = useTranslations('local-project/page');
  const { data } = useAgentsServiceListAgents();

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(LIMIT);

  const pagedData = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.slice(offset, offset + limit);
  }, [data, offset, limit]);

  const hasNextPage = useMemo(() => {
    if (!data) {
      return false;
    }

    return data.length > offset + LIMIT;
  }, [data, offset]);

  const columns: Array<ColumnDef<AgentState>> = useMemo(
    () => [
      {
        header: t('table.columns.id'),
        accessorKey: 'id',
      },
      {
        header: t('table.columns.name'),
        accessorKey: 'name',
      },
      {
        header: t('table.columns.actions'),
        id: 'actions',
        cell: ({ row }) => (
          <Button
            size="small"
            href={`/local-project/agents/${row.original.id}`}
            color="secondary"
            label={t('table.openInADE')}
          />
        ),
      },
    ],
    [t]
  );

  return (
    <DashboardPageLayout title={t('title')} actions={<CreateAgentDialog />}>
      <DashboardPageSection>
        <DataTable
          autofitHeight
          offset={offset}
          onLimitChange={setLimit}
          limit={limit}
          hasNextPage={hasNextPage}
          showPagination
          onSetOffset={setOffset}
          columns={columns}
          data={pagedData}
          isLoading={!data}
          loadingText={t('table.loading')}
          noResultsText={t('table.noResults')}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default LocalProjectPage;

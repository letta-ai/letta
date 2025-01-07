import { useTranslations } from '@letta-cloud/translations';
import {
  ToolsService,
  useAgentsServiceCreateAgent,
  useHealthServiceHealthCheck,
  useLlmsServiceListEmbeddingModels,
  useLlmsServiceListModels,
  useToolsServiceListTools,
} from '@letta-web/letta-agents-api';
import { useCurrentDevelopmentServerConfig } from '@letta-web/helpful-client-utils';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dialog,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  RawCodeEditor,
  Section,
  StarterKitItems,
  toast,
  VStack,
} from '@letta-web/component-library';
import { useNavigate } from 'react-router-dom';
import { STARTER_KITS } from '@letta-cloud/agent-starter-kits';
import type { StarterKit } from '@letta-cloud/agent-starter-kits';

interface CreateAgentDialogProps {
  trigger: React.ReactNode;
}

export function CreateLocalAgentDialog(props: CreateAgentDialogProps) {
  const { trigger } = props;
  const t = useTranslations('CreateLocalAgentDialog');

  const { data: llmModels } = useLlmsServiceListModels();
  const { data: embeddingModels } = useLlmsServiceListEmbeddingModels();
  const [isPending, setIsPending] = useState(false);

  const {
    mutateAsync: createAgent,
    isSuccess,
    error,
  } = useAgentsServiceCreateAgent();

  const { refetch: getAllTools } = useToolsServiceListTools({}, undefined, {
    enabled: false,
  });

  const developmentServerConfig = useCurrentDevelopmentServerConfig();
  const navigate = useNavigate();

  const handleCreateAgent = useCallback(
    async (title: string, starterKit: StarterKit) => {
      if (!developmentServerConfig) {
        return;
      }

      if (isPending || isSuccess) {
        return;
      }

      try {
        setIsPending(true);

        const { agentState } = starterKit;

        if (starterKit.tools) {
          const existingTools = await getAllTools();

          const toolNameMap = (existingTools.data || []).reduce((acc, tool) => {
            acc.add(tool.name || '');

            return acc;
          }, new Set<string>());

          const toolsToCreate = starterKit.tools.filter((tool) => {
            return !toolNameMap.has(tool.name);
          });

          await Promise.all(
            toolsToCreate.map((tool) => {
              return ToolsService.createTool({
                requestBody: {
                  source_code: tool.code,
                  description: 'A custom tool',
                  name: tool.name,
                },
              });
            }),
          );
        }

        const nextName = `${title
          .toLowerCase()
          .replace(/ /g, '-')}-agent-${Date.now()}`;

        const response = await createAgent({
          requestBody: {
            ...agentState,
            memory_blocks: agentState.memory_blocks || [],
            name: nextName,
            tools: [
              'archival_memory_insert',
              'archival_memory_search',
              'conversation_search',
              'conversation_search_date',
              'send_message',
              'core_memory_append',
              'core_memory_replace',
              ...(starterKit.tools || []).map((tool) => tool.name),
            ],
            llm_config: llmModels?.[0],
            embedding_config: embeddingModels?.[0],
          },
        });

        navigate(`/dashboard/agents/${response.id}`);
      } catch (_e) {
        setIsPending(false);
      } finally {
        setIsPending(false);
      }
    },
    [
      developmentServerConfig,
      isPending,
      isSuccess,
      t,
      createAgent,
      llmModels,
      embeddingModels,
      getAllTools,
    ],
  );

  const starterKits = useMemo(() => {
    return Object.entries(STARTER_KITS);
  }, []);

  const loadingCopy = useMemo(() => {
    if (isSuccess || isPending) {
      return t('creating');
    }

    if (!llmModels || !embeddingModels) {
      return t('loading');
    }

    return false;
  }, [isSuccess, isPending, llmModels, embeddingModels, t]);

  return (
    <Dialog
      hideFooter
      title={t('title')}
      disableForm
      size="xxlarge"
      trigger={trigger}
    >
      <Section
        title={t('starterKits.title')}
        description={t('starterKits.description')}
      >
        {loadingCopy ? (
          <LoadingEmptyStatusComponent
            emptyMessage=""
            isLoading
            loadingMessage={loadingCopy}
          />
        ) : (
          <VStack paddingBottom gap="form" className="max-w-[1052px]">
            {!!error && (
              <Alert variant="destructive" title={t('error')}>
                <RawCodeEditor
                  fullWidth
                  label=""
                  language="javascript"
                  code={JSON.stringify(error, null, 2)}
                />
              </Alert>
            )}
            <VStack>
              <NiceGridDisplay itemWidth="250px" itemHeight="260px">
                {starterKits.map(([id, starterKit]) => (
                  <StarterKitItems
                    onSelectStarterKit={handleCreateAgent}
                    key={id}
                    starterKit={starterKit}
                  />
                ))}
              </NiceGridDisplay>
            </VStack>
          </VStack>
        )}
      </Section>
    </Dialog>
  );
}

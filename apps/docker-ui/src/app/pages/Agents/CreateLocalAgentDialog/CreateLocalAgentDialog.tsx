import { useTranslations } from '@letta-cloud/translations';
import {
  ToolsService,
  useAgentsServiceCreateAgent,
  useLlmsServiceListEmbeddingModels,
  useLlmsServiceListModels,
  useToolsServiceListTools,
} from '@letta-cloud/sdk-core';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dialog,
  LoadingEmptyStatusComponent,
  RawCodeEditor,
  Section,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useNavigate } from 'react-router-dom';
import type { StarterKit } from '@letta-cloud/config-agent-starter-kits';
import { StarterKitSelector } from '@letta-cloud/ui-ade-components';

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
  const navigate = useNavigate();

  const handleCreateAgent = useCallback(
    async (title: string, starterKit: StarterKit) => {

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
            tools: (starterKit.tools || []).map((tool) => tool.name),
            llm_config: llmModels?.[0],
            embedding_config: embeddingModels?.[0],
          },
        });

        navigate(`/agents/${response.id}`);
      } catch (_e) {
        setIsPending(false);
      } finally {
        setIsPending(false);
      }
    },
    [
      isPending,
      isSuccess,
      createAgent,
      llmModels,
      embeddingModels,
      getAllTools,
      navigate,
    ],
  );

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
              <StarterKitSelector
                architectures={['memgpt', 'sleeptime']}
                onSelectStarterKit={handleCreateAgent}
              />
            </VStack>
          </VStack>
        )}
      </Section>
    </Dialog>
  );
}

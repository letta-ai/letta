'use client';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Dialog,
  Frame,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  RawCodeEditor,
  Section,
  toast,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useCurrentDevelopmentServerConfig } from '../../hooks/useCurrentDevelopmentServerConfig/useCurrentDevelopmentServerConfig';
import { useCallback, useMemo, useState } from 'react';
import type { StarterKit } from '$letta/client';
import { STARTER_KITS } from '$letta/client';
import {
  ToolsService,
  useToolsServiceListTools,
} from '@letta-web/letta-agents-api';
import { useHealthServiceHealthCheck } from '@letta-web/letta-agents-api';
import {
  useAgentsServiceCreateAgent,
  useLlmsServiceListEmbeddingModels,
  useLlmsServiceListModels,
} from '@letta-web/letta-agents-api';
import { useRouter } from 'next/navigation';
import { trackClientSideEvent } from '@letta-web/analytics/client';
import { AnalyticsEvent } from '@letta-web/analytics';
import { useCurrentUser } from '$letta/client/hooks';
import { ConnectToLocalServerCommand } from '$letta/client/components';
import { StarterKitItems } from '$letta/client/components';

interface CreateAgentDialogProps {
  trigger: React.ReactNode;
}

function CreateAgentDialog(props: CreateAgentDialogProps) {
  const { trigger } = props;
  const t = useTranslations('development-servers/agents/CreateAgentDialog');

  const { data: llmModels } = useLlmsServiceListModels();
  const { data: embeddingModels } = useLlmsServiceListEmbeddingModels();
  const config = useCurrentDevelopmentServerConfig();

  const { data: isHealthy, isLoading: isFetchingStatus } =
    useHealthServiceHealthCheck(undefined, {
      retry: false,
    });

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
  const { push } = useRouter();
  const user = useCurrentUser();

  const handleCreateAgent = useCallback(
    async (title: string, starterKit: StarterKit) => {
      if (!developmentServerConfig) {
        return;
      }

      if (isFetchingStatus) {
        toast.error(t('isFetchingStatus'));
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
            })
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

        trackClientSideEvent(AnalyticsEvent.LOCAL_AGENT_CREATED, {
          userId: user?.id || '',
          starterKitId: starterKit.id,
        });

        push(
          `/development-servers/${developmentServerConfig.id}/agents/${response.id}`
        );
      } catch (_e) {
        setIsPending(false);
      } finally {
        setIsPending(false);
      }
    },
    [
      developmentServerConfig,
      isFetchingStatus,
      isPending,
      isSuccess,
      t,
      createAgent,
      llmModels,
      embeddingModels,
      user?.id,
      push,
      getAllTools,
    ]
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
          /* eslint-disable-next-line react/forbid-component-props */
          <VStack paddingBottom gap="form" className="max-w-[1052px]">
            {isHealthy && (
              <Alert
                variant="info"
                title={t('alert.title', {
                  serverName:
                    config?.id === 'local'
                      ? t('alert.local')
                      : `"${config?.name || ''}"` || '',
                })}
              >
                {config?.id === 'local'
                  ? t('alert.descriptionLocal')
                  : t('alert.descriptionRemote')}
              </Alert>
            )}
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
              {!isHealthy && !isFetchingStatus ? (
                <Alert title={t('serverOffline')} variant="destructive">
                  <VStack paddingTop="small">
                    <Typography>{t('serverOfflineConnect')}</Typography>
                    <Frame>
                      <ConnectToLocalServerCommand color="destructive" />
                    </Frame>
                  </VStack>
                </Alert>
              ) : (
                <NiceGridDisplay itemWidth="250px" itemHeight="260px">
                  {starterKits.map(([id, starterKit]) => (
                    <StarterKitItems
                      onSelectStarterKit={handleCreateAgent}
                      key={id}
                      starterKit={starterKit}
                    />
                  ))}
                </NiceGridDisplay>
              )}
            </VStack>
          </VStack>
        )}
      </Section>
    </Dialog>
  );
}

export default CreateAgentDialog;

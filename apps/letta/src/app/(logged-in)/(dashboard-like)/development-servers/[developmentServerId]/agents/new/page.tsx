'use client';
import { useTranslations } from 'next-intl';
import {
  Alert,
  DashboardPageLayout,
  DashboardPageSection,
  ImageCard,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  RawCodeEditor,
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

interface StarterKitItemProps {
  starterKit: StarterKit;
  onCreateAgent: (title: string, starterKit: StarterKit) => void;
}

function StarterKitItem(props: StarterKitItemProps) {
  const { starterKit, onCreateAgent } = props;
  const t = useTranslations('development-servers/agents/new/page');
  const { useGetTitle, useGetDescription, image } = starterKit;

  const title = useGetTitle();
  const description = useGetDescription();

  return (
    <ImageCard
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[270px]"
      onClick={() => {
        onCreateAgent(title, starterKit);
      }}
      imageUrl={image}
      altText=""
      title={title}
      description={description}
    >
      <VStack paddingTop>
        {starterKit.tools && (
          <Typography variant="body2" align="left">
            {t.rich('tools', {
              strong: (v) => (
                <Typography variant="body2" overrideEl="span" bold>
                  {v}
                </Typography>
              ),
              toolsList: starterKit.tools.map((v) => v.name).join(', '),
            })}
          </Typography>
        )}
      </VStack>
    </ImageCard>
  );
}

function NewAgentPage() {
  const t = useTranslations('development-servers/agents/new/page');

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
            name: nextName,
            tools: [
              'archival_memory_insert',
              'archival_memory_search',
              'conversation_search',
              'conversation_search_date',
              'send_message',
              ...(starterKit.tools || []).map((tool) => tool.name),
            ],
            llm_config: llmModels?.[0],
            embedding_config: embeddingModels?.[0],
            ...agentState,
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

  return (
    <DashboardPageLayout
      title={t('title')}
      returnButton={{
        href: `/development-servers/${config?.id}/agents`,
        text: t('back'),
      }}
    >
      <DashboardPageSection>
        {isSuccess || isPending ? (
          <LoadingEmptyStatusComponent
            emptyMessage=""
            isLoading
            loadingMessage={t('loading')}
          />
        ) : (
          /* eslint-disable-next-line react/forbid-component-props */
          <VStack gap="form" className="max-w-[1052px]">
            {isHealthy && (
              <Alert
                variant="info"
                title={t('alert.title', { serverName: config?.name || '' })}
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
              <VStack gap={false}>
                <Typography>{t('starterKits.title')}</Typography>
                <Typography color="muted">
                  {t('starterKits.description')}
                </Typography>
              </VStack>
              {!isHealthy && !isFetchingStatus ? (
                <Alert title={t('serverOffline')} variant="destructive" />
              ) : (
                <NiceGridDisplay itemWidth="250px" itemHeight="260px">
                  {starterKits.map(([id, starterKit]) => (
                    <StarterKitItem
                      onCreateAgent={handleCreateAgent}
                      key={id}
                      starterKit={starterKit}
                    />
                  ))}
                </NiceGridDisplay>
              )}
            </VStack>
          </VStack>
        )}
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default NewAgentPage;

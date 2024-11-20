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
import { useCallback, useMemo } from 'react';
import type { StarterKit } from '$letta/client';
import { STARTER_KITS } from '$letta/client';
import type { AgentState } from '@letta-web/letta-agents-api';
import {
  useAgentsServiceCreateAgent,
  useLlmsServiceListEmbeddingModels,
  useLlmsServiceListModels,
} from '@letta-web/letta-agents-api';
import { useRouter } from 'next/navigation';
import { useDevelopmentServerStatus } from '../../../hooks/useDevelopmentServerStatus/useDevelopmentServerStatus';

interface StarterKitItemProps {
  starterKit: StarterKit;
  onCreateAgent: (title: string, agentState: Partial<AgentState>) => void;
}

function StarterKitItem(props: StarterKitItemProps) {
  const { starterKit, onCreateAgent } = props;
  const { useGetTitle, useGetDescription, image, agentState } = starterKit;

  const title = useGetTitle();
  const description = useGetDescription();

  return (
    <ImageCard
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[260px]"
      onClick={() => {
        onCreateAgent(title, agentState);
      }}
      imageUrl={image}
      altText=""
      title={title}
      description={description}
    />
  );
}

function NewAgentPage() {
  const t = useTranslations('development-servers/agents/new/page');
  const config = useCurrentDevelopmentServerConfig();

  const { data: llmModels } = useLlmsServiceListModels();
  const { data: embeddingModels } = useLlmsServiceListEmbeddingModels();

  const {
    isHealthy,
    isInitialFetch,
    isFetching: isFetchingStatus,
  } = useDevelopmentServerStatus(config?.url || '');

  const {
    mutate: createAgent,
    isPending,
    isSuccess,
    error,
  } = useAgentsServiceCreateAgent();

  const developmentServerConfig = useCurrentDevelopmentServerConfig();
  const { push } = useRouter();

  const handleCreateAgent = useCallback(
    (title: string, agentState: Partial<AgentState>) => {
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

      const nextName = `${title
        .toLowerCase()
        .replace(/ /g, '-')}-agent-${Date.now()}`;

      createAgent(
        {
          requestBody: {
            name: nextName,
            tools: [
              'archival_memory_insert',
              'archival_memory_search',
              'conversation_search',
              'conversation_search_date',
              'send_message',
            ],
            llm_config: llmModels?.[0],
            embedding_config: embeddingModels?.[0],
            ...agentState,
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
      t,
      isFetchingStatus,
      createAgent,
      developmentServerConfig,
      embeddingModels,
      isPending,
      isSuccess,
      llmModels,
      push,
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
              {!isHealthy && !isInitialFetch ? (
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

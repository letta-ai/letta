import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useDateFormatter } from '@letta-cloud/utils-client';
import {
  VersionHistory,
  Button,
  HStack,
  LoadingEmptyStatusComponent,
  Typography,
  VStack,
  AgentStateViewer,
  Badge,
  Tooltip,
} from '@letta-cloud/ui-component-library';
import {
  type AgentStateVersions,
  useAgentStateFromVersionName,
} from '$web/client/hooks/useAgentStateFromVersionName/useAgentStateFromVersionName';

interface VersionDetailsProps {
  version: AgentStateVersions;
}

function VersionDetails(props: VersionDetailsProps) {
  const { version } = props;

  const { agentName } = useCurrentAgentMetaData();
  const agentState = useAgentStateFromVersionName(version);

  const t = useTranslations('pages/distribution/VersionHistory');

  return (
    <VStack padding flex overflowY="auto" collapseHeight>
      <VStack gap="small" fullWidth>
        <HStack
          /* eslint-disable-next-line react/forbid-component-props */
          className="min-h-[24px]"
          justify="spaceBetween"
          fullWidth
          align="center"
        >
          <Typography
            fullWidth
            overflow="ellipsis"
            noWrap
            uppercase
            variant="body3"
            bold
          >
            {agentName}:{version}
          </Typography>
          {version === 'current' && (
            <Tooltip content={t('notSaved.tooltip')}>
              <Badge
                variant="warning"
                uppercase
                size="small"
                content={t('notSaved.label')}
              />
            </Tooltip>
          )}
        </HStack>
        {!agentState ? (
          <LoadingEmptyStatusComponent isLoading loaderVariant="grower" />
        ) : (
          <AgentStateViewer baseState={agentState} />
        )}
      </VStack>
    </VStack>
  );
}

const VERSION_HEIGHT = 70;

export function VersionHistorySection() {
  const [limit, setLimit] = useState(0);
  const { agentId } = useCurrentAgentMetaData();
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('pages/distribution/VersionHistory');

  const {
    data: versionData,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = webApi.agentTemplates.listTemplateVersions.useInfiniteQuery({
    queryKey: webApiQueryKeys.agentTemplates.listTemplateVersionsWithSearch(
      agentId,
      {
        limit,
      },
    ),
    queryData: ({ pageParam }) => ({
      query: {
        limit: limit,
        offset: pageParam.offset,
      },
      params: {
        agentTemplateId: agentId,
      },
    }),
    initialPageParam: { offset: 0 },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.body.hasNextPage) {
        return {
          offset: allPages.length * limit,
        };
      }

      return undefined;
    },
  });

  useEffect(() => {
    if (containerRef.current) {
      const newLimit = Math.ceil(
        containerRef.current.clientHeight / VERSION_HEIGHT,
      );
      setLimit(newLimit);
    }
  }, []);

  const versions = useMemo(() => {
    if (!versionData) {
      return [];
    }

    return versionData.pages?.flatMap((v) => v.body.versions) || [];
  }, [versionData]);

  const { formatDateAndTime } = useDateFormatter();

  const versionHistoryItems = useMemo(() => {
    return [
      {
        title: t('workingVersion'),
        details: <VersionDetails key="current" version="current" />,
      },
      ...versions.map((version) => ({
        title: t('version', {
          version: version.version,
        }),
        message: version.message,
        subtitle: formatDateAndTime(version.createdAt),
        details: (
          <VersionDetails key={version.version} version={version.version} />
        ),
      })),
    ];
  }, [versions, formatDateAndTime, t]);

  return (
    <VStack gap="small" overflow="hidden" fullHeight>
      <VStack
        paddingX="small"
        paddingBottom="small"
        overflowY="auto"
        collapseHeight
        flex
        ref={containerRef}
      >
        {!versionData || versions.length === 0 ? (
          <LoadingEmptyStatusComponent
            isLoading={isLoading}
            loaderVariant="grower"
            emptyMessage={t('noVersions')}
            loadingMessage={t('loading')}
          />
        ) : (
          <VersionHistory
            versions={versionHistoryItems}
            loadMoreButton={
              hasNextPage && (
                <Button
                  busy={isFetchingNextPage}
                  fullWidth
                  color="secondary"
                  label={t('loadMore')}
                  onClick={() => {
                    void fetchNextPage();
                  }}
                  disabled={isLoading}
                />
              )
            }
          />
        )}
      </VStack>
    </VStack>
  );
}

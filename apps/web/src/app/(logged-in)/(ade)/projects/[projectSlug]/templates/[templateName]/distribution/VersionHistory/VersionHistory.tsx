import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useDateFormatter } from '@letta-cloud/utils-client';
import {
  Badge,
  Button,
  CalendarIcon,
  CloseIcon,
  CloseMiniApp,
  HStack,
  LoadingEmptyStatusComponent,
  MiniApp,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { CompareTemplateVersions } from '$web/client/components';
import type { AgentState } from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';

interface CompareVersionDialogProps {
  version: string;
  trigger: React.ReactNode;
}
function CompareVersionDialog(props: CompareVersionDialogProps) {
  const { version, trigger } = props;
  const t = useTranslations('pages/distribution/VersionHistory');
  const [open, setOpen] = useState(false);
  const agentState = useCurrentAgent();

  return (
    <MiniApp
      appName={t('CompareVersionDialog.title')}
      onOpenChange={setOpen}
      isOpen={open}
      trigger={trigger}
    >
      <VStack overflow="hidden" gap={false}>
        <HStack
          height="header"
          align="center"
          justify="spaceBetween"
          borderBottom
          paddingX
          fullWidth
        >
          <HStack>
            <Typography bold>{t('CompareVersionDialog.title')}</Typography>
          </HStack>
          <CloseMiniApp data-testid="close-verion-dialog">
            <HStack>
              <CloseIcon />
            </HStack>
          </CloseMiniApp>
        </HStack>
        <VStack overflowY="auto" flex collapseHeight padding="small">
          <CompareTemplateVersions
            leftComparisonVersion="current"
            rightComparisonVersion={version}
            defaultLeftComparisonState={agentState as AgentState}
          />
        </VStack>
      </VStack>
    </MiniApp>
  );
}

const VERSION_HEIGHT = 70;

export function VersionHistory() {
  const [limit, setLimit] = useState(0);
  const { agentId } = useCurrentAgentMetaData();
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('pages/distribution');

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
        {!versionData && (
          <LoadingEmptyStatusComponent
            isLoading
            loadingMessage={t('VersionHistory.loading')}
          />
        )}
        {!!versionData && versions.length === 0 && (
          <LoadingEmptyStatusComponent
            emptyMessage={t('VersionHistory.noVersions')}
          />
        )}
        {versions.map((version) => (
          <VStack key={version.id} border padding="small" fullWidth>
            <HStack align="center" justify="spaceBetween" fullWidth>
              <HStack align="center" fullWidth overflow="hidden">
                <Badge content={version.version} />
                <Typography
                  align="left"
                  fullWidth
                  overflow="ellipsis"
                  variant="body3"
                  font="mono"
                >
                  {version.message || t('VersionHistory.noMessage')}
                </Typography>
              </HStack>
              <HStack>
                <CompareVersionDialog
                  version={version.version}
                  trigger={
                    <Button
                      label={t('VersionHistory.compare')}
                      color="tertiary"
                      size="small"
                    />
                  }
                />
              </HStack>
            </HStack>
            <HStack align="center">
              <CalendarIcon />
              <Typography variant="body2">
                {formatDateAndTime(version.createdAt)}
              </Typography>
            </HStack>
          </VStack>
        ))}
        {hasNextPage && (
          <Button
            busy={isFetchingNextPage}
            fullWidth
            color="secondary"
            label="Load more versions"
            onClick={() => {
              void fetchNextPage();
            }}
            disabled={isLoading}
          />
        )}
      </VStack>
    </VStack>
  );
}

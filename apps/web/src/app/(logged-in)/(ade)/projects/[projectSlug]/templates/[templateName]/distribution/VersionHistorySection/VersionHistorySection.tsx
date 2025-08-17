import React, { useMemo, useRef } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import {
  VersionHistory,
  HStack,
  LoadingEmptyStatusComponent,
  Typography,
  VStack,
  TemplateSnapshotViewer,
  Badge,
  Tooltip,
} from '@letta-cloud/ui-component-library';
import type { AgentStateVersions } from '$web/client/hooks/useAgentStateFromVersionName/useAgentStateFromVersionName';
import { useCurrentTemplateSnapshot } from '$web/client/hooks/useCurrentTemplateSnapshot/useCurrentTemplateSnapshot';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useCurrentTemplateName } from '$web/client/hooks/useCurrentTemplateName/useCurrentTemplateName';

interface VersionDetailsProps {
  version: AgentStateVersions;
}

function VersionDetails(props: VersionDetailsProps) {
  const { version } = props;

  const templateName = useCurrentTemplateName();

  const t = useTranslations('pages/distribution/VersionHistory');

  const { data: templateSnapshot } = useCurrentTemplateSnapshot(version);

  return (
    <VStack collapseHeight overflow="hidden" fullWidth>
      <VStack gap={false} fullHeight fullWidth>
        <HStack
          /* eslint-disable-next-line react/forbid-component-props */
          className="min-h-[36px]"
          justify="spaceBetween"
          fullWidth
          paddingX="small"
          borderBottom
          align="center"
        >
          <Typography
            fullWidth
            overflow="ellipsis"
            noWrap
            uppercase
            variant="body4"
            bold
          >
            {templateName}:{version}
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
        <VStack flex overflowY="auto" color="background" collapseHeight>
          {!templateSnapshot ? (
            <LoadingEmptyStatusComponent isLoading loaderVariant="grower" />
          ) : (
            <TemplateSnapshotViewer baseState={templateSnapshot.body} />
          )}
        </VStack>
      </VStack>
    </VStack>
  );
}

export function VersionHistorySection() {
  const { slug: projectSlug } = useCurrentProject();
  const templateName = useCurrentTemplateName();
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('pages/distribution/VersionHistory');

  // Fetch only the first 10 versions from the API
  const { data: versionData, isLoading } =
    cloudAPI.templates.listTemplateVersions.useQuery({
      queryKey: cloudQueryKeys.templates.listTemplateVersionsWithQuery(
        projectSlug,
        templateName,
        {
          limit: 10,
        },
      ),
      queryData: {
        query: {
          limit: '10',
          offset: '0',
        },
        params: {
          project_slug: projectSlug,
          name: templateName,
        },
      },
    });

  const versions = useMemo(() => {
    if (!versionData?.body?.versions) {
      return [];
    }

    const fetchedVersions = versionData.body.versions;

    // If we have no versions, return empty
    if (fetchedVersions.length === 0) {
      return [];
    }

    // Find the oldest fetched version number
    const oldestFetchedVersion = Math.min(
      ...fetchedVersions.map((v) => parseInt(v.version)),
    );

    // Generate versions from oldestFetchedVersion - 1 down to 1
    const generatedVersions = [];
    for (let i = oldestFetchedVersion - 1; i >= 1; i--) {
      generatedVersions.push({
        version: i.toString(),
        created_at: '', // Leave blank as requested
        message: undefined,
        is_latest: false,
      });
    }

    // Combine fetched versions with generated versions
    return [...fetchedVersions, ...generatedVersions];
  }, [versionData]);

  const { formatDateAndTime } = useFormatters();

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
        subtitle: version.created_at
          ? formatDateAndTime(version.created_at)
          : undefined,
        details: (
          <VersionDetails key={version.version} version={version.version} />
        ),
      })),
    ];
  }, [versions, formatDateAndTime, t]);

  return (
    <VStack gap="small" overflow="hidden" fullHeight>
      <VStack
        borderTop
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
          <VersionHistory versions={versionHistoryItems} />
        )}
      </VStack>
    </VStack>
  );
}

import type { AgentState } from '@letta-cloud/letta-agents-api';
import { useCurrentAgent } from '../../../../app/(logged-in)/(ade)/projects/[projectSlug]/agents/[agentId]/hooks';
import React from 'react';
import {
  AgentStateViewer,
  HStack,
  LoadingEmptyStatusComponent,
  Typography,
  VStack,
} from '@letta-cloud/component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import { useTranslations } from '@letta-cloud/translations';

/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
type Versions = string | 'current' | 'latest';

function useAgentStateFromVersionName(
  versionName: Versions,
  defaultState?: AgentState,
) {
  const currentAgent = useCurrentAgent();

  if (versionName === 'current') {
    return currentAgent;
  }

  const { data: leftState } =
    webApi.agentTemplates.getAgentTemplateByVersion.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateByVersion(
        `${currentAgent.name}:${versionName}`,
      ),
      queryData: {
        params: { slug: `${currentAgent.name}:${versionName}` },
      },
      retry: false,
    });

  return leftState?.body.state || defaultState;
}

interface CompareTemplateVersionsProps {
  leftComparisonVersion: Versions;
  rightComparisonVersion: Versions;
  defaultLeftComparisonState?: AgentState;
  defaultRightComparisonState?: AgentState;
}

export function CompareTemplateVersions(props: CompareTemplateVersionsProps) {
  const { name } = useCurrentAgent();
  const t = useTranslations('components/CompareTemplateVersions');

  const {
    leftComparisonVersion,
    defaultLeftComparisonState,
    rightComparisonVersion,
  } = props;

  const leftAgentState = useAgentStateFromVersionName(
    leftComparisonVersion,
    defaultLeftComparisonState,
  );

  const rightAgentState = useAgentStateFromVersionName(
    rightComparisonVersion,
    defaultLeftComparisonState,
  );

  return (
    <VStack flex collapseHeight>
      <HStack border gap={false}>
        <VStack flex fullWidth borderRight paddingRight="none" padding="small">
          <Typography bold>{`${name}:${leftComparisonVersion}`}</Typography>
        </VStack>
        <VStack flex fullWidth padding="small" color="brand-light">
          <Typography bold>{`${name}:${rightComparisonVersion}`}</Typography>
        </VStack>
      </HStack>
      <VStack border flex collapseHeight overflowY="auto">
        {!leftAgentState || !rightAgentState ? (
          <LoadingEmptyStatusComponent
            isLoading
            loadingMessage={t('loading')}
          />
        ) : (
          <AgentStateViewer
            baseState={leftAgentState as AgentState}
            comparedState={rightAgentState as AgentState}
          />
        )}
      </VStack>
    </VStack>
  );
}

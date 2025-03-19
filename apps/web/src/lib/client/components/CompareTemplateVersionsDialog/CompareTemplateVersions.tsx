import type { AgentState } from '@letta-cloud/sdk-core';
import React from 'react';
import {
  AgentStateViewer,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';

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
  leftNameOverride?: string;
  rightNameOverride?: string;
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
    leftNameOverride,
    rightNameOverride,
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
      <VStack border flex collapseHeight overflowY="auto">
        {!leftAgentState || !rightAgentState ? (
          <LoadingEmptyStatusComponent
            isLoading
            loadingMessage={t('loading')}
          />
        ) : (
          <AgentStateViewer
            baseName={
              leftNameOverride
                ? leftNameOverride
                : `${name}:${leftComparisonVersion}`
            }
            comparedName={
              rightNameOverride
                ? rightNameOverride
                : `${name}:${rightComparisonVersion}`
            }
            baseState={leftAgentState as AgentState}
            comparedState={rightAgentState as AgentState}
          />
        )}
      </VStack>
    </VStack>
  );
}

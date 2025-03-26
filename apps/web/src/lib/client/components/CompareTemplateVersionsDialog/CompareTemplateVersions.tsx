import type { AgentState } from '@letta-cloud/sdk-core';
import React from 'react';
import {
  AgentStateViewer,
  LoadingEmptyStatusComponent,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import {
  type AgentStateVersions,
  useAgentStateFromVersionName,
} from '$web/client/hooks/useAgentStateFromVersionName/useAgentStateFromVersionName';

interface CompareTemplateVersionsProps {
  leftComparisonVersion: AgentStateVersions;
  rightComparisonVersion: AgentStateVersions;
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
    <>
      {!leftAgentState || !rightAgentState ? (
        <LoadingEmptyStatusComponent isLoading loadingMessage={t('loading')} />
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
          baseState={leftAgentState}
          comparedState={rightAgentState}
        />
      )}
    </>
  );
}

import React from 'react';
import {
  TemplateSnapshotViewer,
  LoadingEmptyStatusComponent,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
import type {
  AgentStateVersions,
} from '$web/client/hooks/useAgentStateFromVersionName/useAgentStateFromVersionName';
import { useCurrentTemplateSnapshot } from '$web/client/hooks/useCurrentTemplateSnapshot/useCurrentTemplateSnapshot';

interface CompareTemplateVersionsProps {
  leftComparisonVersion: AgentStateVersions;
  rightComparisonVersion: AgentStateVersions;
  leftNameOverride?: string;
  rightNameOverride?: string;
}

export function CompareTemplateVersions(props: CompareTemplateVersionsProps) {
  const { name } = useCurrentAgent();
  const t = useTranslations('components/CompareTemplateVersions');


  const {
    leftComparisonVersion,
    rightComparisonVersion,
    leftNameOverride,
    rightNameOverride,
  } = props;

  const leftAgentState = useCurrentTemplateSnapshot(
    leftComparisonVersion,
  );

  const rightAgentState = useCurrentTemplateSnapshot(
    rightComparisonVersion,
  );

  return (
    <>
      {!leftAgentState?.data || !rightAgentState?.data ? (
        <LoadingEmptyStatusComponent isLoading loadingMessage={t('loading')} />
      ) : (
        <TemplateSnapshotViewer
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
          baseState={leftAgentState.data.body}
          comparedState={rightAgentState.data.body}
        />
      )}
    </>
  );
}

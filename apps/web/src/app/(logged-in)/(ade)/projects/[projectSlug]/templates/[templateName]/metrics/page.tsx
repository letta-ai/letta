'use client';
import { ADEPage } from '$web/client/components/ADEPage/ADEPage';
import React from 'react';
import { ObservabilityProvider } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import ProjectObservabilityPage from '../../../../../../(dashboard-like)/projects/[projectSlug]/observability/page';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { VStack } from '@letta-cloud/ui-component-library';

export default function MetricsPage() {
  const { agentId, agentName } = useCurrentAgentMetaData();

  return (
    <ObservabilityProvider
      noTemplateFilter={true}
      baseTemplate={{
        label: agentName,
        value: agentId || '',
      }}
    >
      <ADEPage>
        <VStack borderRight borderTop borderBottom fullWidth fullHeight>
          <ProjectObservabilityPage />
        </VStack>
      </ADEPage>
    </ObservabilityProvider>
  );
}

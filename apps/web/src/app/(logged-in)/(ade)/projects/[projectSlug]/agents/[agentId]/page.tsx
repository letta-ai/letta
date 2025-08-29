'use client';
import React, { useEffect } from 'react';
import { CloudAgentEditor } from '$web/client/components/CloudAgentEditor/CloudAgentEditor';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useAgentsServiceRetrieveAgent } from '@letta-cloud/sdk-core';
import { useParams, useRouter } from 'next/navigation';
import { ADEError } from '$web/client/components/ADEError/ADEError';

function AgentsAgentPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { id: currentProjectId } = useCurrentProject();
  const { data: agent, isLoading } = useAgentsServiceRetrieveAgent(
    {
      agentId,
    },
    undefined,
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
    },
  );


  const { push } = useRouter()

  useEffect(() => {
    if (currentProjectId && agent && currentProjectId !== agent?.project_id) {
      push(`/agents/${agentId}`);
    }
  }, [currentProjectId, agent, agentId, push]);

  if (!isLoading && !agent) {
    return <ADEError errorCode="agentNotFound" />;
  }



  return <CloudAgentEditor />;
}

export default AgentsAgentPage;

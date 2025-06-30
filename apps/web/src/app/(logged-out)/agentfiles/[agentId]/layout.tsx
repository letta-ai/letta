import React from 'react';
import { webApiQueryKeys } from '$web/client';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import { router } from '$web/web-api/router';

interface ProjectPageWrapperProps {
  params: Promise<{
    agentId: string;
  }>;
  children: React.ReactNode;
}

async function AgentfileViewerLayout(props: ProjectPageWrapperProps) {
  const { agentId } = await props.params;
  const queryClient = new QueryClient();

  if (!agentId) {
    redirect('/');
    return;
  }

  const agentFile = await router.agentfile.getAgentfileSummary({
    params: { agentId },
  });

  if (!agentFile.body || agentFile.status !== 200) {
    redirect('/');
    return;
  }

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.agentfile.getAgentfileSummary(agentId),
    queryFn: () => agentFile,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

export default AgentfileViewerLayout;

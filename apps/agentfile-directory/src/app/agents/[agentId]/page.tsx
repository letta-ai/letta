import { externalWebApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { redirect } from 'next/navigation';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { AgentHeader } from './_components/AgentHeader/AgentHeader';
import { AgentDetails } from './_components/AgentDetails/AgentDetails';

interface AgentPageLayoutProps {
  params: Promise<{
    agentId: string;
  }>;
}

export default async function AgentPage(props: AgentPageLayoutProps) {
  const { agentId } = await props.params;

  const queryClient = new QueryClient();

  const res = await externalWebApi.agentfile.getAgentfileDetails.query({
    params: {
      agentId,
    },
  });

  if (res.status !== 200) {
    redirect('/');
    return;
  }

  await queryClient.prefetchQuery({
    queryKey: webApiQueryKeys.agentfile.getAgentfileDetails(agentId),
    queryFn: () => res,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AgentHeader
        name={res.body.name}
        author={res.body.author}
        downloadCount={res.body.downloadCount}
        upvotes={res.body.upvotes}
        downvotes={res.body.downvotes}
      />
      <AgentDetails agent={res.body} />
    </HydrationBoundary>
  );
}

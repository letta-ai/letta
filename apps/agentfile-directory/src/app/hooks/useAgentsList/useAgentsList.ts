import type { webApiContracts } from '@letta-cloud/sdk-web';
import type { ServerInferResponseBody } from '@ts-rest/core';
import { useInfiniteQuery } from '@tanstack/react-query';

interface UseAgentsListArgs {
  search?: string;
  limit?: number;
}

type AgentResponse = ServerInferResponseBody<
  typeof webApiContracts.agentfile.listAgentfiles
>;

export function useAgentsList(args: UseAgentsListArgs) {
  const { search, limit = 10 } = args;

  return useInfiniteQuery<AgentResponse>({
    initialPageParam: { offset: 0 },
    queryKey: ['agents', { search, limit }],
    getNextPageParam: (lastPage, allPages) => {
      const currentOffset = allPages.length * (limit || 10);
      if (lastPage?.hasNextPage) {
        return { offset: currentOffset, limit: limit || 10 };
      }

      return undefined;
    },
    queryFn: async ({ pageParam }) => {
      const searchParams = new URLSearchParams();

      if (search) {
        searchParams.set('search', search);
      }

      if (limit) {
        searchParams.set('limit', limit.toString());
      }

      // @ts-expect-error - correct typing
      searchParams.set('offset', pageParam?.offset?.toString() || '0');

      const response = await fetch(`/api/agents?${searchParams.toString()}`);

      if (response.status !== 200) {
        throw new Error('Failed to fetch agents');
      }

      return await response.json();
    },
  });
}

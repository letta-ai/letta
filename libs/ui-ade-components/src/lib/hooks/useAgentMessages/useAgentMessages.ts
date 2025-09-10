import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { LettaMessageUnion, ListMessagesResponse } from '@letta-cloud/sdk-core';
import { UseAgentsServiceListMessagesKeyFn } from '@letta-cloud/sdk-core';
import type { InfiniteData } from '@tanstack/query-core';
import { useCurrentAPIHostConfig } from '@letta-cloud/utils-client';
import { useGetMessagesWorker } from '../../ade/panels/Messages/useGetMessagesWorker/useGetMessagesWorker';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';

const MESSAGE_LIMIT = 25;

interface UseAgentMessagesOptions {
  refetchInterval?: number | false;
  agentId: string,
  isEnabled?: boolean;
}

// remove duplicate messages based on id+message_type
export function removeDuplicateMessages(
  messages: ListMessagesResponse,
): ListMessagesResponse {
  const messageExistingMap = new Set<string>();
  return messages.filter((message) => {
    const uid = `${message.id}-${message.message_type}`;
    if (messageExistingMap.has(uid)) {
      return false;
    }
    messageExistingMap.add(uid);
    return true;
  });
}

export function useAgentMessages(options: UseAgentMessagesOptions) {
  const { isLocal } = useCurrentAgentMetaData();
  const hostConfig = useCurrentAPIHostConfig({
    isLocal,
    attachApiKey: true,
  });
  const { getMessages } = useGetMessagesWorker();

  const queryClient = useQueryClient();
  const { data: includeErr = false } = useFeatureFlag('SHOW_ERRORED_MESSAGES');

  const { refetchInterval, isEnabled, agentId } = options;
  return useInfiniteQuery<
      LettaMessageUnion[],
      Error,
      InfiniteData<ListMessagesResponse>,
      unknown[],
      { before?: string }
    >({
      refetchInterval,
      queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
      queryFn: async (query) => {
        const res = (await getMessages({
          url: hostConfig?.url,
          headers: {
            'X-SOURCE-CLIENT': window.location.pathname,
            ...isLocal ? hostConfig.headers : {},
          },
          agentId,
          limit: MESSAGE_LIMIT,
          includeErr: includeErr,
          ...(query.pageParam.before ? { cursor: query.pageParam.before } : {}),
        })) as unknown as ListMessagesResponse;

        if (query.pageParam.before) {
          return res;
        }

        const data = queryClient.getQueriesData<
          InfiniteData<ListMessagesResponse>
        >({
          queryKey: UseAgentsServiceListMessagesKeyFn({ agentId }),
        });

        const firstPage = data[0]?.[1]?.pages[0] || [];

        return removeDuplicateMessages([
          ...(firstPage as LettaMessageUnion[]),
          ...(Array.isArray(res) ? res : []),
        ]) as ListMessagesResponse;
      },
      getNextPageParam: (lastPage) => {
        if (!Array.isArray(lastPage)) {
          return undefined;
        }

        if (lastPage.length < MESSAGE_LIMIT) {
          return undefined;
        }

        return {
          before: lastPage.toSorted(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          )[0].id,
        };
      },
      enabled: !!agentId && isEnabled,
      initialPageParam: { before: '' },
    });
}

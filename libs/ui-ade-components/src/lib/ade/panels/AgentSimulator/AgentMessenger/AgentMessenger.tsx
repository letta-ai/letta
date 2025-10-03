import { useAgentRunMessages, useCurrentAgent } from '../../../../hooks';
import { Frame, LoadingEmptyStatusComponent, VStack } from '@letta-cloud/ui-component-library';
import { RunBlock } from './RunBlock/RunBlock';
import { useManageAgentMessengerMessages } from './hooks/useManageMessageScroller/useManageAgentMessengerMessages';
import { AgentMessengerInput } from './AgentMessengerInput/AgentMessengerInput';

export function AgentMessenger() {
  const { id: agentId } = useCurrentAgent();

  const { runResponses, sendMessage, loadMoreRuns,  loadingState } = useAgentRunMessages({
    agentId,
  });


  const { scrollRef } = useManageAgentMessengerMessages({
    isSendingMessage: loadingState.isSendingMessage,
    runResponses,
    isFetchingOlderRuns: loadingState.isFetchingRuns,
    fetchOlderRuns: () => {
      if (loadingState.isFetchingRuns) {
        return;
      }
      loadMoreRuns();
    },
  });

  if (loadingState.isInitialLoad) {
    return (
      <LoadingEmptyStatusComponent isLoading />
    )
  }

  return (
    <VStack  gap="xlarge" color="background" paddingTop fullHeight >
      <Frame ref={scrollRef} flex  paddingX overflowX="hidden" collapseHeight overflowY="auto">
        <div className="pt-8" />
        {runResponses.toReversed().map((response, index) => (
          <RunBlock key={index} runResponse={response} />
        ))}
      </Frame>
      <AgentMessengerInput
        onSendMessage={sendMessage}
        isSending={loadingState.isSendingMessage}
      />
    </VStack>
  );
}

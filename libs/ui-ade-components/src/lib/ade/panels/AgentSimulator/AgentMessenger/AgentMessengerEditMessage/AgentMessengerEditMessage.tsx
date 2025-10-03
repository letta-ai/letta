import type { LettaMessageUnion } from '@letta-cloud/sdk-core';
import { useCurrentSimulatedAgent } from '../../../../../hooks/useCurrentSimulatedAgent/useCurrentSimulatedAgent';
import { useAgentRunMessages } from '../../../../../hooks/useAgentRunMessages/useAgentRunMessages';
import { EditMessage } from '../../../Messages/MessageGroups/Message/EditMessage/EditMessage';

interface AgentMessengerEditMessageProps {
  message: LettaMessageUnion;
  onClose: VoidFunction;
}

export function AgentMessengerEditMessage(props: AgentMessengerEditMessageProps) {
  const { message, onClose } = props;
  const { id: agentId } = useCurrentSimulatedAgent();
  const { editMessage } = useAgentRunMessages({ agentId });

  const handleSuccess = (updatedMessage: LettaMessageUnion) => {
    editMessage(updatedMessage);
    onClose();
  };

  return (
    <EditMessage
      message={message}
      onSuccess={handleSuccess}
      onClose={onClose}
    />
  );
}

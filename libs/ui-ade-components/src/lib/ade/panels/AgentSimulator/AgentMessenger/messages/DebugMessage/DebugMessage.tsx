import type { RunResponseMessage } from '../../../../../../hooks';
import { JSONViewer, VStack } from '@letta-cloud/ui-component-library';

interface DebugMessageProps {
  message: RunResponseMessage
}

export function DebugMessage(props: DebugMessageProps) {
  const { message } = props;

  return (
    <VStack>
      <JSONViewer data={message} />
    </VStack>
  )

}

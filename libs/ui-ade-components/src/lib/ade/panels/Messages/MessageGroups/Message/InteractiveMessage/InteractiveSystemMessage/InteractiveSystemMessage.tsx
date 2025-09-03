import type { SystemMessage } from '@letta-cloud/sdk-core';
import { JSONViewer, Typography, VStack } from '@letta-cloud/ui-component-library';

interface InteractiveSystemMessageProps {
  message: SystemMessage
}

export function InteractiveSystemMessage(props: InteractiveSystemMessageProps) {
  const { message } = props;

  return (
    <VStack color="background-grey2" padding="xsmall" border fullWidth>
      <Typography variant="body3">
        <JSONViewer data={message.content}  />
      </Typography>
    </VStack>
  );

}

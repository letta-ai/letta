import { HStack } from '../../../framing/HStack/HStack';
import { Typography } from '../../Typography/Typography';
import { VStack } from '../../../framing/VStack/VStack';

interface MessageEventProps {
  name: React.ReactNode;
  icon: React.ReactNode;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
}

export function MessageEvent(props: MessageEventProps) {
  const { name, icon, rightContent, children } = props;

  return (
    <HStack fullWidth padding="small" className="relative message-replay">
      <div className="message-replay-event-bar" />
      <div className="bg-background-grey2 w-8 h-8 flex p-0 items-center justify-center">
        {icon}
      </div>
      <VStack fullWidth className="pt-1.5">
        <HStack align="center" justify="spaceBetween">
          <Typography variant="body2" bold>
            <HStack as="span" gap="small" align="center">
              {name}
            </HStack>
          </Typography>
          <HStack align="center">{rightContent}</HStack>
        </HStack>
        <HStack className="message-replay-event-content" gap="small">
          {children}
        </HStack>
      </VStack>
    </HStack>
  );
}

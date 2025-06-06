'use client';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import './EventItem.scss';

interface MessageEventProps {
  name: React.ReactNode;
  icon: React.ReactNode;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
}

export function EventItem(props: MessageEventProps) {
  const { name, icon, rightContent, children } = props;

  return (
    <HStack
      align="start"
      fullWidth
      padding="small"
      className="relative message-replay"
    >
      <div className="message-replay-event-bar" />
      <div className="bg-background-grey2 z-[1] w-8 h-8 min-w-8 flex p-0 items-center justify-center">
        {icon}
      </div>
      <VStack gap={false} fullWidth>
        <HStack className="h-8" align="center" justify="spaceBetween">
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

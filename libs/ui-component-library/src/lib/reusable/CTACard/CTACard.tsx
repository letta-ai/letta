import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { Slot } from '@radix-ui/react-slot';
import { Typography } from '../../core/Typography/Typography';
import { Frame } from '../../framing/Frame/Frame';

interface CTACardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}

export function CTACard(props: CTACardProps) {
  const { icon, title, subtitle, action } = props;
  return (
    <VStack padding justify="spaceBetween" border className="h-[252px]">
      <Slot className="w-[56px] h-[56px]">{icon}</Slot>
      <VStack>
        <Typography variant="heading5">{title}</Typography>
        <Typography variant="heading6">{subtitle}</Typography>
      </VStack>
      <Frame>{action}</Frame>
    </VStack>
  );
}

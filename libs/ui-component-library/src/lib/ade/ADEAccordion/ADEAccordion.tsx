import * as React from 'react';
import { Typography } from '../../core/Typography/Typography';
import { Accordion } from '../../core/Accordion/Accordion';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';

interface ADEAccordionProps {
  id: string;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  minHeight?: number;
}

export function ADEAccordion(props: ADEAccordionProps) {
  const { id, label, children, defaultOpen = true, minHeight } = props;

  return (
    <Accordion
      id={id}
      defaultOpen={defaultOpen}
      trigger={
        <Typography
          uppercase
          bold
          noWrap
          overflow="ellipsis"
          color="default"
          variant="body4"
        >
          {label}
        </Typography>
      }
      theme="ade"
    >
      <div style={{ minHeight }}>
        <HStack
          fullWidth
          fullHeight
          className="cursor-pointer"
          color="background-grey"
          paddingY="xxsmall"
        >
          <VStack overflow="hidden" fullHeight fullWidth flex>
            {children}
          </VStack>
        </HStack>
      </div>
    </Accordion>
  );
}

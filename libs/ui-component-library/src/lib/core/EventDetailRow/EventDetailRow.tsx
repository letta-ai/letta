'use client';
import { useState } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { CaretDownIcon, CaretRightIcon } from '../../icons';
import { Typography } from '../Typography/Typography';

interface KeyValueRenderProps {
  label: string;
  value: React.ReactNode;
  details?: React.ReactNode;
}

export function EventDetailRow(props: KeyValueRenderProps) {
  const { label, value, details } = props;

  const [open, setOpen] = useState(false);

  return (
    <VStack
      gap={false}
      color={open ? 'background-grey2' : 'transparent'}
      padding="xxsmall"
      className="relative"
    >
      <HStack
        align="center"
        gap="small"
        as={details ? 'button' : 'span'}
        onClick={() => {
          if (!details) return;

          setOpen(!open);
        }}
      >
        {!!details && (
          <div className="flex min-w-2">
            {!open ? <CaretRightIcon /> : <CaretDownIcon />}
          </div>
        )}
        <HStack align="center">
          <Typography overrideEl="span" variant="body2" bold>
            {label}
          </Typography>
          <Typography overrideEl="span" variant="body2">
            {value}
          </Typography>
        </HStack>
      </HStack>
      {open && !!details && <VStack>{details}</VStack>}
    </VStack>
  );
}

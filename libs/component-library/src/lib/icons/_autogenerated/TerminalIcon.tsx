import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function TerminalIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M96-192v-576h768v576H96Zm72-72h624v-360H168v360Zm132-48-51-51 81-81-81-81 51-51 132 132-132 132Zm180 0v-72h240v72H480Z" />
      </svg>
    </IconWrapper>
  );
}

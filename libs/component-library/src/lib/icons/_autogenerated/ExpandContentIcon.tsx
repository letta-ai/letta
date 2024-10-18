import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ExpandContentIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M240-240v-240h72v168h168v72H240Zm408-240v-168H480v-72h240v240h-72Z" />
      </svg>
    </IconWrapper>
  );
}

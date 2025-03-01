import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ArrowUpwardAltIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M444-240v-294L339-429l-51-51 192-192 192 192-51 51-105-105v294h-72Z" />
      </svg>
    </IconWrapper>
  );
}

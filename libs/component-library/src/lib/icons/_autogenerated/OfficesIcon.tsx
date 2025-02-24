import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function OfficesIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="currentColor"
      >
        <path d="M80-120v-720h400v160h400v560H80Zm80-80h240v-80H160v80Zm0-160h240v-80H160v80Zm0-160h240v-80H160v80Zm0-160h240v-80H160v80Zm320 480h320v-400H480v400Zm80-240v-80h160v80H560Zm0 160v-80h160v80H560Z" />
      </svg>
    </IconWrapper>
  );
}

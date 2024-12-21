import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function PlayIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M7 15L14.8571 10L7 5V15Z" fill="currentColor" />
      </svg>
    </IconWrapper>
  );
}

import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function FullscreenIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6.09625 15.9038H17.9038V8.09625H6.09625V15.9038ZM2.5 19.5V4.5H21.5V19.5H2.5ZM4 18H20V6H4V18Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

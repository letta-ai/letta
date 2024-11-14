import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ExpandTextareaIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M13.416 13.0833V4.33325H12.166V11.8333H4.66602V13.0833H13.416ZM9.66602 9.33325V0.583252H8.41602V8.08325H0.916016V9.33325H9.66602Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

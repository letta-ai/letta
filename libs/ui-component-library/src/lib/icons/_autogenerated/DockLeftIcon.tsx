import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function DockLeftIcon(props: IconWrappedProps) {
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
          d="M5.5 12.25H12.25V1.75H5.5V12.25ZM0.625 13.375V0.625H13.375V13.375H0.625Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

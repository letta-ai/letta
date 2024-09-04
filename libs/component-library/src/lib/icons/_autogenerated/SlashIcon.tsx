import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function SlashIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.10876 14L9.46582 1H10.8178L5.46074 14H4.10876Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

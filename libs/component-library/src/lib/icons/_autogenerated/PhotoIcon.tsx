import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function PhotoIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 4C2 2.89543 2.89543 2 4 2H12C13.1046 2 14 2.89543 14 4V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4ZM12.5 9.70711C12.5 9.5745 12.4473 9.44732 12.3536 9.35355L11.3536 8.35355C11.1583 8.15829 10.8417 8.15829 10.6464 8.35355L9.35355 9.64645C9.15829 9.84171 8.84171 9.84171 8.64645 9.64645L6.35355 7.35355C6.15829 7.15829 5.84171 7.15829 5.64645 7.35355L3.64645 9.35355C3.55268 9.44732 3.5 9.5745 3.5 9.70711V12C3.5 12.2761 3.72386 12.5 4 12.5H12C12.2761 12.5 12.5 12.2761 12.5 12V9.70711ZM12 5C12 5.55228 11.5523 6 11 6C10.4477 6 10 5.55228 10 5C10 4.44772 10.4477 4 11 4C11.5523 4 12 4.44772 12 5Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

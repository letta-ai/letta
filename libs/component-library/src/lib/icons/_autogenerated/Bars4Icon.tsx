import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function Bars4Icon(props: IconWrappedProps) {
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
          d="M2 2.75C2 2.33579 2.33579 2 2.75 2H13.25C13.6642 2 14 2.33579 14 2.75C14 3.16421 13.6642 3.5 13.25 3.5H2.75C2.33579 3.5 2 3.16421 2 2.75ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H13.25C13.6642 12.5 14 12.8358 14 13.25C14 13.6642 13.6642 14 13.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 6.25C2 5.83579 2.33579 5.5 2.75 5.5H13.25C13.6642 5.5 14 5.83579 14 6.25C14 6.66421 13.6642 7 13.25 7H2.75C2.33579 7 2 6.66421 2 6.25ZM2 9.75C2 9.33579 2.33579 9 2.75 9H13.25C13.6642 9 14 9.33579 14 9.75C14 10.1642 13.6642 10.5 13.25 10.5H2.75C2.33579 10.5 2 10.1642 2 9.75Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

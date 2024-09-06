import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ArrowDownRightIcon(props: IconWrappedProps) {
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
          d="M4.21967 4.21967C3.92678 4.51256 3.92678 4.98744 4.21967 5.28033L9.43934 10.5H5.75C5.33579 10.5 5 10.8358 5 11.25C5 11.6642 5.33579 12 5.75 12H11.25C11.6642 12 12 11.6642 12 11.25V5.75C12 5.33579 11.6642 5 11.25 5C10.8358 5 10.5 5.33579 10.5 5.75V9.43934L5.28033 4.21967C4.98744 3.92678 4.51256 3.92678 4.21967 4.21967Z"
          fill="#0F172A"
        />
      </svg>
    </IconWrapper>
  );
}

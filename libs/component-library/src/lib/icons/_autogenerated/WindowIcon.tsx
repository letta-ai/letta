import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function WindowIcon(props: IconWrappedProps) {
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
          d="M2 12V4C2 2.89543 2.89543 2 4 2H12C13.1046 2 14 2.89543 14 4V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12ZM3.5 6.5V12C3.5 12.2761 3.72386 12.5 4 12.5H12C12.2761 12.5 12.5 12.2761 12.5 12V6.5C12.5 6.22386 12.2761 6 12 6H4C3.72386 6 3.5 6.22386 3.5 6.5ZM4.25 4.75C4.66421 4.75 5 4.41421 5 4C5 3.58579 4.66421 3.25 4.25 3.25C3.83579 3.25 3.5 3.58579 3.5 4C3.5 4.41421 3.83579 4.75 4.25 4.75ZM7 4C7 4.41421 6.66421 4.75 6.25 4.75C5.83579 4.75 5.5 4.41421 5.5 4C5.5 3.58579 5.83579 3.25 6.25 3.25C6.66421 3.25 7 3.58579 7 4ZM8.25 4.75C8.66421 4.75 9 4.41421 9 4C9 3.58579 8.66421 3.25 8.25 3.25C7.83579 3.25 7.5 3.58579 7.5 4C7.5 4.41421 7.83579 4.75 8.25 4.75Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}

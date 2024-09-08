import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function BarsArrowDownIcon(props: IconWrappedProps) {
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
          d="M2 2.75C2 2.33579 2.33579 2 2.75 2H12.25C12.6642 2 13 2.33579 13 2.75C13 3.16421 12.6642 3.5 12.25 3.5H2.75C2.33579 3.5 2 3.16421 2 2.75Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2 6.25C2 5.83579 2.33579 5.5 2.75 5.5H8.25C8.66421 5.5 9 5.83579 9 6.25C9 6.66421 8.66421 7 8.25 7H2.75C2.33579 7 2 6.66421 2 6.25ZM2 9.75C2 9.33579 2.33579 9 2.75 9H6.25C6.66421 9 7 9.33579 7 9.75C7 10.1642 6.66421 10.5 6.25 10.5H2.75C2.33579 10.5 2 10.1642 2 9.75Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M14.7803 11.4697C15.0732 11.7626 15.0732 12.2374 14.7803 12.5303L12.5303 14.7803C12.2374 15.0732 11.7626 15.0732 11.4697 14.7803L9.21967 12.5303C8.92678 12.2374 8.92678 11.7626 9.21967 11.4697C9.51256 11.1768 9.98744 11.1768 10.2803 11.4697L11.25 12.4393V6.75C11.25 6.33579 11.5858 6 12 6C12.4142 6 12.75 6.33579 12.75 6.75V12.4393L13.7197 11.4697C14.0126 11.1768 14.4874 11.1768 14.7803 11.4697Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

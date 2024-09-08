import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ChevronDoubleUpIcon(props: IconWrappedProps) {
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
          d="M7.46967 3.21967C7.76256 2.92678 8.23744 2.92678 8.53033 3.21967L11.7803 6.46967C12.0732 6.76256 12.0732 7.23744 11.7803 7.53033C11.4874 7.82322 11.0126 7.82322 10.7197 7.53033L8 4.81066L5.28033 7.53033C4.98744 7.82322 4.51256 7.82322 4.21967 7.53033C3.92678 7.23744 3.92678 6.76256 4.21967 6.46967L7.46967 3.21967ZM4.21967 11.4697L7.46967 8.21967C7.76256 7.92678 8.23744 7.92678 8.53033 8.21967L11.7803 11.4697C12.0732 11.7626 12.0732 12.2374 11.7803 12.5303C11.4874 12.8232 11.0126 12.8232 10.7197 12.5303L8 9.81066L5.28033 12.5303C4.98744 12.8232 4.51256 12.8232 4.21967 12.5303C3.92678 12.2374 3.92678 11.7626 4.21967 11.4697Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

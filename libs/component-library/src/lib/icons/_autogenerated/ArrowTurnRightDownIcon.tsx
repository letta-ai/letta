import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ArrowTurnRightDownIcon(props: IconWrappedProps) {
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
          d="M2 2.75C2 3.16421 2.33579 3.5 2.75 3.5L9.25 3.5L9.25 11.4393L8.28033 10.4697C7.98744 10.1768 7.51256 10.1768 7.21967 10.4697C6.92678 10.7626 6.92678 11.2374 7.21967 11.5303L9.46967 13.7803C9.76256 14.0732 10.2374 14.0732 10.5303 13.7803L12.7803 11.5303C13.0732 11.2374 13.0732 10.7626 12.7803 10.4697C12.4874 10.1768 12.0126 10.1768 11.7197 10.4697L10.75 11.4393V2.75C10.75 2.33579 10.4142 2 10 2L2.75 2C2.33579 2 2 2.33579 2 2.75Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}

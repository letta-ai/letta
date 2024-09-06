import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ArrowTurnRightUpIcon(props: IconWrappedProps) {
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
          d="M2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H9.25L9.25 4.56066L8.28033 5.53033C7.98744 5.82322 7.51256 5.82322 7.21967 5.53033C6.92678 5.23744 6.92678 4.76256 7.21967 4.46967L9.46967 2.21967C9.76256 1.92678 10.2374 1.92678 10.5303 2.21967L12.7803 4.46967C13.0732 4.76256 13.0732 5.23744 12.7803 5.53033C12.4874 5.82322 12.0126 5.82322 11.7197 5.53033L10.75 4.56066V13.25C10.75 13.6642 10.4142 14 10 14H2.75C2.33579 14 2 13.6642 2 13.25Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}

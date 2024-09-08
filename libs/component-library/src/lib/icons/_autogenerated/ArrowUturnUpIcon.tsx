import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ArrowUturnUpIcon(props: IconWrappedProps) {
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
          d="M6.25 12.5C7.76878 12.5 9 11.2688 9 9.75L9 4.56066L6.78033 6.78033C6.48744 7.07322 6.01256 7.07322 5.71967 6.78033C5.42678 6.48744 5.42678 6.01256 5.71967 5.71967L9.21967 2.21967C9.51256 1.92678 9.98744 1.92678 10.2803 2.21967L13.7803 5.71967C14.0732 6.01256 14.0732 6.48744 13.7803 6.78033C13.4874 7.07322 13.0126 7.07322 12.7197 6.78033L10.5 4.56066V9.75C10.5 12.0972 8.59721 14 6.25 14C3.90279 14 2 12.0972 2 9.75L2 8.75C2 8.33579 2.33579 8 2.75 8C3.16421 8 3.5 8.33579 3.5 8.75L3.5 9.75C3.5 11.2688 4.73122 12.5 6.25 12.5Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

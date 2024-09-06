import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function MagnifyingGlassMinusIcon(props: IconWrappedProps) {
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
          d="M8.75 6.25L5.25 6.25C4.83579 6.25 4.5 6.58579 4.5 7C4.5 7.41421 4.83579 7.75 5.25 7.75L8.75 7.75C9.16421 7.75 9.5 7.41421 9.5 7C9.5 6.58579 9.16421 6.25 8.75 6.25Z"
          fill="black"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7 12C8.11014 12 9.13578 11.6382 9.96544 11.0261L12.7197 13.7803C13.0126 14.0732 13.4874 14.0732 13.7803 13.7803C14.0732 13.4874 14.0732 13.0126 13.7803 12.7197L11.0261 9.96544C11.6382 9.13578 12 8.11014 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12ZM7 10.5C8.933 10.5 10.5 8.933 10.5 7C10.5 5.067 8.933 3.5 7 3.5C5.067 3.5 3.5 5.067 3.5 7C3.5 8.933 5.067 10.5 7 10.5Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}

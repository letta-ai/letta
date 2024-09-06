import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ArrowLongDownIcon(props: IconWrappedProps) {
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
          d="M8 2C8.41421 2 8.75 2.33579 8.75 2.75V11.4393L9.96967 10.2197C10.2626 9.92678 10.7374 9.92678 11.0303 10.2197C11.3232 10.5126 11.3232 10.9874 11.0303 11.2803L8.53033 13.7803C8.23744 14.0732 7.76256 14.0732 7.46967 13.7803L4.96967 11.2803C4.67678 10.9874 4.67678 10.5126 4.96967 10.2197C5.26256 9.92678 5.73744 9.92678 6.03033 10.2197L7.25 11.4393V2.75C7.25 2.33579 7.58579 2 8 2Z"
          fill="#0F172A"
        />
      </svg>
    </IconWrapper>
  );
}

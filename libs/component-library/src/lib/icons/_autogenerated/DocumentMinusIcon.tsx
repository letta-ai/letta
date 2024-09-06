import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function DocumentMinusIcon(props: IconWrappedProps) {
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
          d="M4 2C3.17157 2 2.5 2.67157 2.5 3.5V12.5C2.5 13.3284 3.17157 14 4 14H12C12.8284 14 13.5 13.3284 13.5 12.5V6.62132C13.5 6.2235 13.342 5.84197 13.0607 5.56066L9.93934 2.43934C9.65804 2.15804 9.2765 2 8.87868 2H4ZM11 9C11 9.41421 10.6642 9.75 10.25 9.75H5.75C5.33579 9.75 5 9.41421 5 9C5 8.58579 5.33579 8.25 5.75 8.25H10.25C10.6642 8.25 11 8.58579 11 9Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}

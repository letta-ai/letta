import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function DocumentArrowUpIcon(props: IconWrappedProps) {
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
          d="M4 2C3.17157 2 2.5 2.67157 2.5 3.5V12.5C2.5 13.3284 3.17157 14 4 14H12C12.8284 14 13.5 13.3284 13.5 12.5V6.62132C13.5 6.2235 13.342 5.84197 13.0607 5.56066L9.93934 2.43934C9.65804 2.15804 9.2765 2 8.87868 2H4ZM8 11.5C7.58579 11.5 7.25 11.1642 7.25 10.75L7.25 8.06066L6.53033 8.78033C6.23744 9.07322 5.76256 9.07322 5.46967 8.78033C5.17678 8.48744 5.17678 8.01256 5.46967 7.71967L7.46967 5.71967C7.76256 5.42678 8.23744 5.42678 8.53033 5.71967L10.5303 7.71967C10.8232 8.01256 10.8232 8.48744 10.5303 8.78033C10.2374 9.07322 9.76256 9.07322 9.46967 8.78033L8.75 8.06066V10.75C8.75 11.1642 8.41421 11.5 8 11.5Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}

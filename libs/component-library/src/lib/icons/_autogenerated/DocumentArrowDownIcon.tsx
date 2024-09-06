import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function DocumentArrowDownIcon(props: IconWrappedProps) {
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
          d="M4 2C3.17157 2 2.5 2.67157 2.5 3.5V12.5C2.5 13.3284 3.17157 14 4 14H12C12.8284 14 13.5 13.3284 13.5 12.5V6.62132C13.5 6.2235 13.342 5.84197 13.0607 5.56066L9.93934 2.43934C9.65804 2.15804 9.2765 2 8.87868 2H4ZM8 5.5C8.41421 5.5 8.75 5.83579 8.75 6.25V8.93934L9.46967 8.21967C9.76256 7.92678 10.2374 7.92678 10.5303 8.21967C10.8232 8.51256 10.8232 8.98744 10.5303 9.28033L8.53033 11.2803C8.23744 11.5732 7.76256 11.5732 7.46967 11.2803L5.46967 9.28033C5.17678 8.98744 5.17678 8.51256 5.46967 8.21967C5.76256 7.92678 6.23744 7.92678 6.53033 8.21967L7.25 8.93934V6.25C7.25 5.83579 7.58579 5.5 8 5.5Z"
          fill="#0F172A"
        />
      </svg>
    </IconWrapper>
  );
}

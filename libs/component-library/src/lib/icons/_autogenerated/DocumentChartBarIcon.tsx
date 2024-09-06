import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function DocumentChartBarIcon(props: IconWrappedProps) {
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
          d="M4 2C3.17157 2 2.5 2.67157 2.5 3.5V12.5C2.5 13.3284 3.17157 14 4 14H12C12.8284 14 13.5 13.3284 13.5 12.5V6.62132C13.5 6.2235 13.342 5.84197 13.0607 5.56066L9.93934 2.43934C9.65804 2.15804 9.2765 2 8.87868 2H4ZM10 7.75C10 7.33579 10.3358 7 10.75 7C11.1642 7 11.5 7.33579 11.5 7.75V11.25C11.5 11.6642 11.1642 12 10.75 12C10.3358 12 10 11.6642 10 11.25V7.75ZM7.25 9.25C7.25 8.83579 7.58579 8.5 8 8.5C8.41421 8.5 8.75 8.83579 8.75 9.25V11.25C8.75 11.6642 8.41421 12 8 12C7.58579 12 7.25 11.6642 7.25 11.25V9.25ZM5.25 10C4.83579 10 4.5 10.3358 4.5 10.75V11.25C4.5 11.6642 4.83579 12 5.25 12C5.66421 12 6 11.6642 6 11.25V10.75C6 10.3358 5.66421 10 5.25 10Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}

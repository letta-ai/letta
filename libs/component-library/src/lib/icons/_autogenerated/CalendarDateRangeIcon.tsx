import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function CalendarDateRangeIcon(props: IconWrappedProps) {
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
          d="M5.75 7.5C5.33579 7.5 5 7.83579 5 8.25C5 8.66421 5.33579 9 5.75 9C6.16421 9 6.5 8.66421 6.5 8.25C6.5 7.83579 6.16421 7.5 5.75 7.5Z"
          fill="currentColor"
        />
        <path
          d="M7.25 8.25C7.25 7.83579 7.58579 7.5 8 7.5H10.25C10.6642 7.5 11 7.83579 11 8.25C11 8.66421 10.6642 9 10.25 9H8C7.58579 9 7.25 8.66421 7.25 8.25Z"
          fill="currentColor"
        />
        <path
          d="M5.75 9.5C5.33579 9.5 5 9.83579 5 10.25C5 10.6642 5.33579 11 5.75 11H8C8.41421 11 8.75 10.6642 8.75 10.25C8.75 9.83579 8.41421 9.5 8 9.5H5.75Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.75 1C4.33579 1 4 1.33579 4 1.75V3C2.89543 3 2 3.89543 2 5V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V5C14 3.89543 13.1046 3 12 3V1.75C12 1.33579 11.6642 1 11.25 1C10.8358 1 10.5 1.33579 10.5 1.75V3H5.5V1.75C5.5 1.33579 5.16421 1 4.75 1ZM3.5 7C3.5 6.44772 3.94772 6 4.5 6H11.5C12.0523 6 12.5 6.44772 12.5 7V11.5C12.5 12.0523 12.0523 12.5 11.5 12.5H4.5C3.94772 12.5 3.5 12.0523 3.5 11.5V7Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
